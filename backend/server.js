const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres_pass@localhost:5432/devops_edu";
const pool = new Pool({
  connectionString,
});

// Helper function to retry DB connection
const connectWithRetry = async (retries = 5, delay = 3000) => {
  while (retries) {
    try {
      console.log(`Connecting to Postgres (Attempts remaining: ${retries})...`);
      const client = await pool.connect();
      console.log("Connected to database successfully!");
      client.release();
      break;
    } catch (err) {
      console.error("Database connection failed. Retrying in 3 seconds...", err.message);
      retries -= 1;
      if (retries === 0) {
        console.error("Could not connect to database. Exiting...");
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

// Initialize DB schema & seed data
const initDb = async () => {
  try {
    // Create courses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
        instructor VARCHAR(255),
        certificate_earned BOOLEAN DEFAULT FALSE,
        certificate_url VARCHAR(500),
        category VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        github_url VARCHAR(500),
        demo_url VARCHAR(500),
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed initial data if empty
    const courseCheck = await pool.query("SELECT COUNT(*) FROM courses");
    if (parseInt(courseCheck.rows[0].count) === 0) {
      console.log("Seeding initial data...");
      const insertCoursesQuery = `
        INSERT INTO courses (title, description, progress, instructor, certificate_earned, certificate_url, category)
        VALUES 
        ('Docker & Kubernetes Masterclass', 'Learn containerization, orchestration, and scaling from scratch.', 80, 'Alex Mercer', false, null, 'DevOps'),
        ('Full-Stack Web Development', 'Master HTML, CSS, JavaScript, React, Node.js, and Postgres.', 100, 'Sarah Connor', true, 'https://example.com/certs/sarah-fs', 'Development'),
        ('Cloud Engineering with AWS', 'Hands-on practice with VPC, EC2, ECS, RDS, Lambda, and IAM.', 30, 'Dave Miller', false, null, 'Cloud')
        RETURNING id;
      `;
      const res = await pool.query(insertCoursesQuery);
      const devopsCourseId = res.rows[0].id; // Docker course ID
      const fsCourseId = res.rows[1].id; // Full-stack course ID

      const insertProjectsQuery = `
        INSERT INTO projects (title, description, github_url, demo_url, course_id)
        VALUES 
        ('Edu Tracker App', 'A React & Node application dockerized and deployed to cloud.', 'https://github.com/example/edu-tracker', 'https://demo.example.com', $1),
        ('Multi-Container Dev Environment', 'A local workspace setup with docker-compose.', 'https://github.com/example/docker-compose-dev', null, $2);
      `;
      await pool.query(insertProjectsQuery, [fsCourseId, devopsCourseId]);
      console.log("Seed data created successfully.");
    }
  } catch (err) {
    console.error("Error initializing database schema", err);
  }
};

// Endpoints

// 1. Get stats
app.get("/api/courses/stats", async (req, res) => {
  try {
    const totalRes = await pool.query("SELECT COUNT(*) FROM courses");
    const certsRes = await pool.query("SELECT COUNT(*) FROM courses WHERE certificate_earned = true");
    const progressRes = await pool.query("SELECT AVG(progress) FROM courses");
    const projectsRes = await pool.query("SELECT COUNT(*) FROM projects");

    res.json({
      totalCourses: parseInt(totalRes.rows[0].count) || 0,
      certificatesEarned: parseInt(certsRes.rows[0].count) || 0,
      avgProgress: Math.round(parseFloat(progressRes.rows[0].avg) || 0),
      totalProjects: parseInt(projectsRes.rows[0].count) || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get all courses (with optional search & category filter)
app.get("/api/courses", async (req, res) => {
  try {
    const { search, category } = req.query;
    let query = "SELECT * FROM courses WHERE 1=1";
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += " ORDER BY updated_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single course with its projects
app.get("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const courseRes = await pool.query("SELECT * FROM courses WHERE id = $1", [id]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    const projectsRes = await pool.query("SELECT * FROM projects WHERE course_id = $1", [id]);
    res.json({
      ...courseRes.rows[0],
      projects: projectsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Create new course
app.post("/api/courses", async (req, res) => {
  try {
    const { title, description, progress, instructor, certificate_earned, certificate_url, category } = req.body;
    const result = await pool.query(
      `INSERT INTO courses (title, description, progress, instructor, certificate_earned, certificate_url, category) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        title,
        description || "",
        progress || 0,
        instructor || "Unknown",
        certificate_earned || false,
        certificate_url || null,
        category || "Other"
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Update course
app.put("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, progress, instructor, certificate_earned, certificate_url, category } = req.body;
    
    // Automatically set certificate_earned = true if progress is 100
    const finalCertificateEarned = (progress === 100) ? true : certificate_earned;

    const result = await pool.query(
      `UPDATE courses 
       SET title = $1, description = $2, progress = $3, instructor = $4, certificate_earned = $5, certificate_url = $6, category = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 
       RETURNING *`,
      [title, description, progress, instructor, finalCertificateEarned, certificate_url, category, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Delete course
app.delete("/api/courses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM courses WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json({ message: "Course deleted successfully", course: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.title as course_title 
      FROM projects p
      LEFT JOIN courses c ON p.course_id = c.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Create a new project
app.post("/api/projects", async (req, res) => {
  try {
    const { title, description, github_url, demo_url, course_id } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (title, description, github_url, demo_url, course_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [title, description || "", github_url || "", demo_url || "", course_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete a project
app.delete("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM projects WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    res.json({ message: "Project deleted successfully", project: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Startup Server
const PORT = process.env.PORT || 3000;
(async () => {
  await connectWithRetry();
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
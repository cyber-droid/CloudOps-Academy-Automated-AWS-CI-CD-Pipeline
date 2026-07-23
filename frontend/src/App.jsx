import { useEffect, useState } from "react";

function App() {
  // Tabs
  const [activeTab, setActiveTab] = useState("courses"); // "courses" or "projects"

  // Courses State
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    totalCourses: 0,
    certificatesEarned: 0,
    avgProgress: 0,
    totalProjects: 0,
  });

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Project List State
  const [projects, setProjects] = useState([]);

  // Forms
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    progress: 0,
    instructor: "",
    certificate_earned: false,
    certificate_url: "",
    category: "DevOps",
  });
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);

  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    github_url: "",
    demo_url: "",
    course_id: "",
  });
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Fetching Data
  const fetchData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch("/api/courses/stats");
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch courses with filters
      let coursesUrl = "/api/courses";
      const params = [];
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (selectedCategory !== "All") params.push(`category=${encodeURIComponent(selectedCategory)}`);
      if (params.length > 0) coursesUrl += `?${params.join("&")}`;

      const coursesRes = await fetch(coursesUrl);
      const coursesData = await coursesRes.json();
      setCourses(coursesData);

      // Fetch projects
      const projectsRes = await fetch("/api/projects");
      const projectsData = await projectsRes.json();
      setProjects(projectsData);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedCategory]);

  // Course Actions
  const handleSaveCourse = async (e) => {
    e.preventDefault();
    if (!courseForm.title) return;

    try {
      const url = editingCourseId ? `/api/courses/${editingCourseId}` : "/api/courses";
      const method = editingCourseId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...courseForm,
          progress: Number(courseForm.progress),
        }),
      });

      if (res.ok) {
        setCourseForm({
          title: "",
          description: "",
          progress: 0,
          instructor: "",
          certificate_earned: false,
          certificate_url: "",
          category: "DevOps",
        });
        setEditingCourseId(null);
        setShowCourseModal(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error saving course:", err);
    }
  };

  const handleEditCourse = (course) => {
    setCourseForm(course);
    setEditingCourseId(course.id);
    setShowCourseModal(true);
  };

  const handleDeleteCourse = async (id) => {
    if (!confirm("Are you sure you want to delete this course?")) return;
    try {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Error deleting course:", err);
    }
  };

  const handleIncrementProgress = async (course, increment) => {
    const nextProgress = Math.min(100, Math.max(0, course.progress + increment));
    try {
      await fetch(`/api/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...course,
          progress: nextProgress,
        }),
      });
      fetchData();
    } catch (err) {
      console.error("Error updating progress:", err);
    }
  };

  // Project Actions
  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!projectForm.title || !projectForm.course_id) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...projectForm,
          course_id: Number(projectForm.course_id),
        }),
      });

      if (res.ok) {
        setProjectForm({
          title: "",
          description: "",
          github_url: "",
          demo_url: "",
          course_id: "",
        });
        setShowProjectModal(false);
        fetchData();
      }
    } catch (err) {
      console.error("Error saving project:", err);
    }
  };

  const handleDeleteProject = async (id) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Error deleting project:", err);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header Banner */}
      <header className="dashboard-header">
        <div className="header-brand">
          <span className="logo-icon">🎓</span>
          <h1>EduTracker</h1>
        </div>
        <p className="subtitle">Track your learning journey, showcase your projects, and manage certifications</p>
      </header>

      {/* Stats Summary Panel */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalCourses}</div>
          <div className="stat-label">Total Courses</div>
          <div className="stat-icon">📚</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgProgress}%</div>
          <div className="stat-label">Average Progress</div>
          <div className="stat-progress-container">
            <div className="stat-progress-bar" style={{ width: `${stats.avgProgress}%` }}></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.certificatesEarned}</div>
          <div className="stat-label">Certificates Earned</div>
          <div className="stat-icon">🏆</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalProjects}</div>
          <div className="stat-label">Showcase Projects</div>
          <div className="stat-icon">🚀</div>
        </div>
      </section>

      {/* Main Tabs Navigation */}
      <div className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === "courses" ? "active" : ""}`}
          onClick={() => setActiveTab("courses")}
        >
          My Courses
        </button>
        <button
          className={`tab-btn ${activeTab === "projects" ? "active" : ""}`}
          onClick={() => setActiveTab("projects")}
        >
          Project Showcase
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      {activeTab === "courses" && (
        <div className="filters-row">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="category-filters">
            {["All", "DevOps", "Development", "Cloud", "Other"].map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <button className="primary-btn" onClick={() => { setEditingCourseId(null); setCourseForm({ title: "", description: "", progress: 0, instructor: "", certificate_earned: false, certificate_url: "", category: "DevOps" }); setShowCourseModal(true); }}>
            + Add Course
          </button>
        </div>
      )}

      {activeTab === "projects" && (
        <div className="filters-row right-align">
          <button className="primary-btn" onClick={() => { if(courses.length === 0) { alert("Please add a course first before linking a project!"); return; } setProjectForm(prev => ({...prev, course_id: courses[0]?.id || ""})); setShowProjectModal(true); }}>
            + Publish Project
          </button>
        </div>
      )}

      {/* TAB CONTENT: COURSES */}
      {activeTab === "courses" && (
        <div className="courses-grid">
          {courses.length === 0 ? (
            <div className="empty-state">No courses found. Add a new one to get started!</div>
          ) : (
            courses.map((course) => (
              <div className="course-card" key={course.id}>
                <div className="course-card-header">
                  <span className={`category-badge badge-${course.category.toLowerCase()}`}>
                    {course.category}
                  </span>
                  <div className="course-actions">
                    <button className="icon-btn edit-btn" onClick={() => handleEditCourse(course)} title="Edit Course">✏️</button>
                    <button className="icon-btn delete-btn" onClick={() => handleDeleteCourse(course.id)} title="Delete Course">🗑️</button>
                  </div>
                </div>

                <h3 className="course-title">{course.title}</h3>
                <p className="course-desc">{course.description}</p>
                <div className="course-meta">
                  <span>Instructor: <strong>{course.instructor}</strong></span>
                </div>

                {/* Progress bar area */}
                <div className="progress-section">
                  <div className="progress-details">
                    <span>Progress</span>
                    <strong>{course.progress}%</strong>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${course.progress}%` }}></div>
                  </div>
                  <div className="progress-adjust">
                    <button className="adjust-btn" onClick={() => handleIncrementProgress(course, -10)}>-10%</button>
                    <button className="adjust-btn" onClick={() => handleIncrementProgress(course, 10)}>+10%</button>
                  </div>
                </div>

                {/* Certification Indicator */}
                <div className="cert-section">
                  {course.progress === 100 ? (
                    <div className="cert-earned-alert">
                      <span className="cert-icon">🏆</span>
                      <div>
                        <div className="cert-status">Completed!</div>
                        {course.certificate_url ? (
                          <a href={course.certificate_url} target="_blank" rel="noreferrer" className="cert-link">View Certificate</a>
                        ) : (
                          <span className="no-cert-link">No link attached</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="cert-pending-alert">
                      <span className="cert-icon-pending">🔒</span>
                      <span>Complete course to earn Certificate</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB CONTENT: PROJECTS */}
      {activeTab === "projects" && (
        <div className="projects-grid">
          {projects.length === 0 ? (
            <div className="empty-state">No projects submitted yet. Connect a project to showcase your work!</div>
          ) : (
            projects.map((project) => (
              <div className="project-card" key={project.id}>
                <div className="project-header">
                  <h3 className="project-title">{project.title}</h3>
                  <button className="icon-btn delete-btn" onClick={() => handleDeleteProject(project.id)}>🗑️</button>
                </div>
                <div className="course-context">Built for: <strong>{project.course_title || "Unknown Course"}</strong></div>
                <p className="project-desc">{project.description}</p>
                <div className="project-links">
                  {project.github_url && (
                    <a href={project.github_url} target="_blank" rel="noreferrer" className="proj-btn github">
                      GitHub Repo
                    </a>
                  )}
                  {project.demo_url && (
                    <a href={project.demo_url} target="_blank" rel="noreferrer" className="proj-btn demo">
                      Live Demo
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* COURSE MODAL */}
      {showCourseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{editingCourseId ? "Edit Course" : "Add Course"}</h2>
            <form onSubmit={handleSaveCourse}>
              <div className="form-group">
                <label>Course Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Docker Fundamentals"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="What is this course about?"
                  rows="3"
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Instructor</label>
                  <input
                    type="text"
                    placeholder="e.g., Alex Mercer"
                    value={courseForm.instructor}
                    onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                  >
                    <option value="DevOps">DevOps</option>
                    <option value="Development">Development</option>
                    <option value="Cloud">Cloud</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Progress ({courseForm.progress}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={courseForm.progress}
                    onChange={(e) => setCourseForm({ ...courseForm, progress: Number(e.target.value) })}
                  />
                </div>
              </div>

              {courseForm.progress === 100 && (
                <div className="form-group">
                  <label>Certificate URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/certificates/123"
                    value={courseForm.certificate_url || ""}
                    onChange={(e) => setCourseForm({ ...courseForm, certificate_url: e.target.value })}
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowCourseModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Save Course</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT MODAL */}
      {showProjectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Publish Project</h2>
            <form onSubmit={handleSaveProject}>
              <div className="form-group">
                <label>Project Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Infrastructure Automation"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Briefly describe your project..."
                  rows="3"
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Associated Course *</label>
                <select
                  required
                  value={projectForm.course_id}
                  onChange={(e) => setProjectForm({ ...projectForm, course_id: e.target.value })}
                >
                  <option value="" disabled>Select a course</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>GitHub Repository URL</label>
                  <input
                    type="url"
                    placeholder="https://github.com/username/project"
                    value={projectForm.github_url}
                    onChange={(e) => setProjectForm({ ...projectForm, github_url: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Live Demo URL</label>
                  <input
                    type="url"
                    placeholder="https://myproject.demo"
                    value={projectForm.demo_url}
                    onChange={(e) => setProjectForm({ ...projectForm, demo_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowProjectModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn">Publish Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
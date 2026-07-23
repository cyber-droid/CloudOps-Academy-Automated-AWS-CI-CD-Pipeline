output "instance_public_ip" {
  description = "The public IP address of the deployed EC2 instance"
  value       = aws_instance.web_server.public_ip
}

output "ssh_connection_string" {
  description = "Convenience SSH command to connect to the instance"
  value       = "ssh -i ${var.key_name}.pem ubuntu@${aws_instance.web_server.public_ip}"
}

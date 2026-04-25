import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

if (projectsTitle) {
  const count = Array.isArray(projects) ? projects.length : 0;
  projectsTitle.textContent = `Projects (${count})`;
}

renderProjects(projects, projectsContainer, 'h2');
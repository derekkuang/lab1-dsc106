import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');


// Counting the number of projects
(async function initProjectsPage() {
    try {
      const projects = await fetchJSON('../lib/projects.json');
  
      const titleEl = document.querySelector('.projects-title');
      if (titleEl) {
        titleEl.textContent = `${projects.length} Projects`;
      }
  
      const projectsContainer = document.querySelector('.projects');
      renderProjects(projects, projectsContainer, 'h2');
    } catch (err) {
      console.error('Error initializing projects page:', err);
    }
  })();
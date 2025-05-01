import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

let selectedIndex = -1;
let query = '';

function getFilteredProjects() {
  // Filter by search query
  let filtered = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
  // Further filter by selected year if a wedge is selected
  if (selectedIndex !== -1) {
    // Get the years present in the current pie chart data
    let rolledData = d3.rollups(
      filtered,
      (v) => v.length,
      (d) => d.year,
    );
    let data = rolledData.map(([year, count]) => {
      return { value: count, label: year };
    });
    if (data[selectedIndex]) {
      const selectedYear = data[selectedIndex].label;
      filtered = filtered.filter(p => String(p.year) === String(selectedYear));
    }
  }
  return filtered;
}

function renderPieChart(projectsGiven) {
  // Group projects by year and count them for the pie chart
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  const colors = d3.scaleOrdinal(d3.schemeTableau10);
  const svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove(); // Clear previous paths

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);
  const arcs = arcData.map((d) => arcGenerator(d));

  arcs.forEach((arc, idx) => {
    svg.append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .attr('class', idx === selectedIndex ? 'selected' : null)
      .on('click', () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;
        // Update classes for all paths
        svg.selectAll('path')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : null));
        // Update classes for all legend items
        let legend = d3.select('.legend');
        legend.selectAll('li')
          .attr('class', (d, i) => 'legend-item' + (i === selectedIndex ? ' selected' : ''));
        // Always render with both filters
        const filtered = getFilteredProjects();
        renderProjects(filtered, projectsContainer, 'h2');
        renderPieChart(
          projects.filter((project) => {
            let values = Object.values(project).join('\n').toLowerCase();
            return values.includes(query.toLowerCase());
          })
        );
      });
  });

  // Create the legend
  let legend = d3.select('.legend');
  legend.selectAll('li').remove(); // Clear previous legend items
  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', 'legend-item' + (idx === selectedIndex ? ' selected' : ''))
      .html(`<span class=\"swatch\"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

// Initial render
renderPieChart(projects);

const searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  // Always render with both filters
  const filtered = getFilteredProjects();
  renderProjects(filtered, projectsContainer, 'h2');
  renderPieChart(
    projects.filter((project) => {
      let values = Object.values(project).join('\n').toLowerCase();
      return values.includes(query.toLowerCase());
    })
  );
});

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
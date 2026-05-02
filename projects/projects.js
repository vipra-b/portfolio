import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const list = Array.isArray(projects) ? projects : [];

/** Stable domain so the same year always keeps the same color when search changes */
const yearDomain = [...new Set(list.map((p) => p.year))].sort((a, b) => a - b);
const yearColor = d3.scaleOrdinal(d3.schemeTableau10).domain(yearDomain);

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

let query = '';
/** @type {number | null} Year filter from pie/legend; null = no year filter */
let selectedYear = null;

function projectMatchesQuery(project, q) {
  if (!q.trim()) return true;
  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(q.trim().toLowerCase());
}

function searchFilteredProjects() {
  return list.filter((p) => projectMatchesQuery(p, query));
}

/** Drop year selection if that year no longer appears after search */
function pruneYearSelection() {
  if (selectedYear === null) return;
  const years = new Set(searchFilteredProjects().map((p) => p.year));
  if (!years.has(selectedYear)) selectedYear = null;
}

function displayedProjects() {
  const base = searchFilteredProjects();
  if (selectedYear === null) return base;
  return base.filter((p) => p.year === selectedYear);
}

function updateTitle(count) {
  if (projectsTitle) {
    projectsTitle.textContent = `${count} project${count === 1 ? '' : 's'}`;
  }
}

function applySelectionAppearance(svgSelection, legendSelection, chartData) {
  svgSelection.selectAll('path').attr('class', (_, idx) => {
    const label = chartData[idx].label;
    if (selectedYear === null) return 'pie-slice';
    return label === selectedYear
      ? 'pie-slice pie-slice--selected'
      : 'pie-slice pie-slice--muted';
  });
  legendSelection.selectAll('li').attr('class', (_, idx) => {
    const label = chartData[idx].label;
    const base = 'legend__item';
    if (selectedYear === null) return base;
    return label === selectedYear
      ? `${base} legend__item--selected`
      : `${base} legend__item--muted`;
  });
}

function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
}


function renderPieChart(projectsForChart) {
  const svg = d3.select('#projects-pie-plot');
  const legend = d3.select('.legend');

  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  if (!projectsForChart.length) {
    return;
  }

  const rolledData = d3.rollups(
    projectsForChart,
    (v) => v.length,
    (d) => d.year,
  );

  const data = rolledData
    .map(([year, count]) => ({
      value: count,
      label: year,
    }))
    .sort((a, b) => a.label - b.label);

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcData = sliceGenerator(data);

  const sliceData = arcData.map((s) => s.data);

  arcData.forEach((d) => {
    const arcPath = arcGenerator(d);
    const year = d.data.label;
    svg
      .append('path')
      .datum(d)
      .attr('d', arcPath)
      .attr('class', 'pie-slice')
      .attr('fill', yearColor(year))
      .on('click', () => {
        toggleYear(year);
        syncFromState();
      });
  });

  data.forEach((d) => {
    legend
      .append('li')
      .attr('class', 'legend__item')
      .attr('style', `--color:${yearColor(d.label)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        toggleYear(d.label);
        syncFromState();
      });
  });

  applySelectionAppearance(svg, legend, sliceData);
}

function syncFromState() {
  pruneYearSelection();
  const forList = displayedProjects();
  const forPie = searchFilteredProjects();
  updateTitle(forList.length);
  renderProjects(forList, projectsContainer, 'h2');
  renderPieChart(forPie);
}

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    query = event.target.value;
    syncFromState();
  });
}

syncFromState();

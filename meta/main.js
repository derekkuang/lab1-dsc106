import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Define scales at global scope
let xScale, yScale;

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/vis-society/lab-7/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: true,
        configurable: true
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  // Create the dl element
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Add total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  // Add total commits
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // Number of files in the codebase (using d3.group for distinct values)
  const uniqueFiles = d3.group(data, d => d.file);
  dl.append('dt').text('Number of files');
  dl.append('dd').text(uniqueFiles.size);

  // Number of authors (distinct values)
  const uniqueAuthors = d3.group(data, d => d.author);
  dl.append('dt').text('Number of authors');
  dl.append('dd').text(uniqueAuthors.size);

  // Maximum file length (in lines) using rollups
  const fileLengths = d3.rollups(
    data,
    group => group.length,
    d => d.file
  );
  const maxFileLength = d3.max(fileLengths, d => d[1]);
  dl.append('dt').text('Maximum file length');
  dl.append('dd').text(maxFileLength + ' lines');

  // Longest file (min/max value)
  const longestFile = d3.greatest(fileLengths, (a, b) => a[1] - b[1])[0];
  dl.append('dt').text('Longest file');
  dl.append('dd').text(longestFile);

  // Average file length (using grouped aggregates)
  const avgFileLength = d3.mean(fileLengths, d => d[1]);
  dl.append('dt').text('Average file length');
  dl.append('dd').text(avgFileLength.toFixed(1) + ' lines');

  // Average line length (aggregates over the whole dataset)
  const avgLineLength = d3.mean(data, d => d.length);
  dl.append('dt').text('Average line length');
  dl.append('dd').text(avgLineLength.toFixed(1) + ' characters');

  // Maximum depth and deepest file
  const maxDepth = d3.max(data, d => d.depth);
  const deepestLine = data.find(d => d.depth === maxDepth);
  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(maxDepth);

  dl.append('dt').text('Deepest file');
  dl.append('dd').text(deepestLine.file);

  // Average depth (aggregates over the whole dataset)
  const avgDepth = d3.mean(data, d => d.depth);
  dl.append('dt').text('Average depth');
  dl.append('dd').text(avgDepth.toFixed(1));

  // Time of day that most work is done
  const workByHour = d3.rollups(
    data,
    group => group.length,
    d => d.datetime.getHours()
  );
  const peakHour = d3.greatest(workByHour, (a, b) => a[1] - b[1])[0];
  const timeOfDay = peakHour < 12 ? 'Morning' :
                   peakHour < 17 ? 'Afternoon' :
                   peakHour < 21 ? 'Evening' : 'Night';
  
  dl.append('dt').text('Peak coding time');
  dl.append('dd').text(`${timeOfDay} (${peakHour}:00)`);
}

function renderTooltipContent(commit) {
  const tooltip = document.getElementById('commit-tooltip');
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.time;
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Update DOM with breakdown
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d)
  );
  
  // Call renderSelectionCount to update the counter
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  
  const [x0, y0] = selection[0];
  const [x1, y1] = selection[1];
  
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function createBrushSelector(svg) {
  // Create brush and listen for events
  svg.call(d3.brush().on('start brush end', brushed));
  
  // Raise dots and everything after overlay
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(data, commits) {
  // Define dimensions
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  
  // Define usable area that accounts for margins
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  
  // Create SVG
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');
  
  // Create scales with adjusted ranges (now assigning to global variables)
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  
  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);
    
  // Calculate the range of edited lines across all commits
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  
  // Create a radius scale
  const rScale = d3
    .scaleSqrt() // Use square root scale for correct area perception
    .domain([minLines, maxLines])
    .range([2, 30]);
  
  // Add gridlines BEFORE the axes
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  // Create gridlines as an axis with no labels and full-width ticks
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
  
  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');
  
  // Add X axis
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);
  
  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);
  
  // Make sure tooltip is hidden initially
  updateTooltipVisibility(false);
  
  // Sort commits by total lines in descending order
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  
  // Draw the scatter plot
  const dots = svg.append('g').attr('class', 'dots');
  
  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
    
  // Set up brush after all elements are drawn
  createBrushSelector(svg);
}

let data = await loadData();
let commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

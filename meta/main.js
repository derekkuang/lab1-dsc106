import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// Define scales at global scope
let xScale, yScale;

// Commit progress slider value and time variables
let commitProgress = 100;
let timeScale, commitMaxTime;

// Will get updated as user changes slider
let filteredCommits;

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
    })
    .sort((a, b) => a.datetime - b.datetime);
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
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : filteredCommits;
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
    .attr('class', 'x-axis')
    .call(xAxis);
  
  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);
  
  // Make sure tooltip is hidden initially
  updateTooltipVisibility(false);
  
  // Sort commits by total lines in descending order
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  
  // Draw the scatter plot
  const dots = svg.append('g').attr('class', 'dots');
  
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
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

function updateScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  // Update the x-axis
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
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
}

function updateCommitInfo(data, commits) {
  // Get the existing stats container
  const dl = d3.select('#stats dl.stats');
  
  // Get all dd elements
  const ddElements = dl.selectAll('dd');
  
  // Get relevant stats for the filtered data
  const filteredData = data.filter(d => 
    commits.some(commit => commit.id === d.commit)
  );
  
  // Update dd elements with new values
  // Total LOC
  ddElements.nodes()[0].textContent = filteredData.length;
  
  // Total commits
  ddElements.nodes()[1].textContent = commits.length;
  
  // Number of files
  const uniqueFiles = d3.group(filteredData, d => d.file);
  ddElements.nodes()[2].textContent = uniqueFiles.size;
  
  // Number of authors
  const uniqueAuthors = d3.group(filteredData, d => d.author);
  ddElements.nodes()[3].textContent = uniqueAuthors.size;
  
  // Maximum file length
  const fileLengths = d3.rollups(
    filteredData,
    group => group.length,
    d => d.file
  );
  
  const maxFileLength = d3.max(fileLengths, d => d[1]);
  ddElements.nodes()[4].textContent = maxFileLength + ' lines';
  
  // Longest file
  const longestFile = d3.greatest(fileLengths, (a, b) => a[1] - b[1]);
  ddElements.nodes()[5].textContent = longestFile ? longestFile[0] : 'N/A';
  
  // Average file length
  const avgFileLength = d3.mean(fileLengths, d => d[1]);
  ddElements.nodes()[6].textContent = avgFileLength ? avgFileLength.toFixed(1) + ' lines' : 'N/A';
  
  // Average line length
  const avgLineLength = d3.mean(filteredData, d => d.length);
  ddElements.nodes()[7].textContent = avgLineLength ? avgLineLength.toFixed(1) + ' characters' : 'N/A';
  
  // Maximum depth and deepest file
  const maxDepth = d3.max(filteredData, d => d.depth);
  ddElements.nodes()[8].textContent = maxDepth || 'N/A';
  
  if (maxDepth) {
    const deepestLine = filteredData.find(d => d.depth === maxDepth);
    ddElements.nodes()[9].textContent = deepestLine ? deepestLine.file : 'N/A';
  } else {
    ddElements.nodes()[9].textContent = 'N/A';
  }
  
  // Average depth
  const avgDepth = d3.mean(filteredData, d => d.depth);
  ddElements.nodes()[10].textContent = avgDepth ? avgDepth.toFixed(1) : 'N/A';
  
  // Peak coding time
  const workByHour = d3.rollups(
    filteredData,
    group => group.length,
    d => new Date(d.datetime).getHours()
  );
  
  if (workByHour.length > 0) {
    const peakHour = d3.greatest(workByHour, (a, b) => a[1] - b[1])[0];
    const timeOfDay = peakHour < 12 ? 'Morning' :
                     peakHour < 17 ? 'Afternoon' :
                     peakHour < 21 ? 'Evening' : 'Night';
    
    ddElements.nodes()[11].textContent = `${timeOfDay} (${peakHour}:00)`;
  } else {
    ddElements.nodes()[11].textContent = 'N/A';
  }
}

function updateFileDisplay(commits) {
  // Get lines from all filtered commits
  let lines = commits.flatMap((d) => d.lines);
  
  // Create a color scale for different technology types
  let colors = d3.scaleOrdinal(d3.schemeTableau10);
  
  // Group lines by file name
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    });
  
  // Sort files by number of lines (descending)
  files.sort((a, b) => b.lines.length - a.lines.length);
  
  // Update the file list display
  let filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      // This code only runs when the div is initially rendered
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt').append('code');
          div.append('dd');
        }),
    );

  // This code updates the div info
  filesContainer.select('dt > code').html((d) => `${d.name} <small>${d.lines.length} lines</small>`);
  
  // append one div for each line
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

let data = await loadData();
let commits = processCommits(data);

// Initialize time scale for the slider
timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
commitMaxTime = timeScale.invert(commitProgress);

// Initialize filteredCommits with all commits
filteredCommits = [...commits];

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
updateFileDisplay(filteredCommits);

// Time slider event handler
function onTimeSliderChange() {
  // Update the commitProgress variable with the slider value
  commitProgress = document.getElementById('commit-progress').value;
  
  // Update the max time based on the slider value
  commitMaxTime = timeScale.invert(commitProgress);
  
  // Update the time display with format "April 11, 2024 at 10:26 AM"
  const date = commitMaxTime.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const time = commitMaxTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  document.getElementById('commit-time').textContent = `${date} at ${time}`;
  
  // Filter commits based on the selected time
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  
  // Update the scatter plot with filtered commits
  updateScatterPlot(data, filteredCommits);
  
  // Update the commit statistics
  updateCommitInfo(data, filteredCommits);
  
  // Update the selection count display
  document.querySelector('#selection-count').textContent = `${filteredCommits.length || 'No'} commits filtered`;
  
  // Update language breakdown with filtered commits
  renderLanguageBreakdown(null);
  
  // Update file display with filtered commits
  updateFileDisplay(filteredCommits);
}

// Attach event listener to the slider
document.getElementById('commit-progress').addEventListener('input', onTimeSliderChange);

// Initialize the time display and filtered commits
onTimeSliderChange();

// Generate commit text for scrollytelling
d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
		Then I looked over all I had made, and I saw that it was very good.
	`,
  );

// Scrollama setup for scrollytelling
function onStepEnter(response) {
  // Get the commit data attached to the step element
  const currentCommit = response.element.__data__;
  const currentDate = currentCommit.datetime;
  
  // Add active class to current step
  d3.selectAll('.step').classed('is-active', false);
  d3.select(response.element).classed('is-active', true);
  
  // Filter commits up to this date
  filteredCommits = commits.filter((d) => d.datetime <= currentDate);
  
  // Update visualizations
  updateScatterPlot(data, filteredCommits);
  updateCommitInfo(data, filteredCommits);
  document.querySelector('#selection-count').textContent = `${filteredCommits.length} commits shown`;
  renderLanguageBreakdown(null);
  updateFileDisplay(filteredCommits);
  
  // Update the slider position to match
  const sliderValue = timeScale(currentDate);
  document.getElementById('commit-progress').value = sliderValue;
  
  // Update the time display
  const date = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const time = currentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  document.getElementById('commit-time').textContent = `${date} at ${time}`;
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
    offset: 0.6,
    debug: false
  })
  .onStepEnter(onStepEnter)
  .onStepExit(response => {
    // Remove the active class when exiting a step
    d3.select(response.element).classed('is-active', false);
  });

// Generate commit text for file visualization scrollytelling
d3.select('#files-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
		Then I looked over all I had made, and I saw that it was very good.
	`,
  );

// Function for file visualization scrollama
function onFileStepEnter(response) {
  // Get the commit data attached to the step element
  const currentCommit = response.element.__data__;
  const currentDate = currentCommit.datetime;
  
  // Add active class to current step
  d3.selectAll('#files-story .step').classed('is-active', false);
  d3.select(response.element).classed('is-active', true);
  
  // Filter commits up to this date
  filteredCommits = commits.filter((d) => d.datetime <= currentDate);
  
  // Update visualizations
  updateFileDisplay(filteredCommits);
  
  // Update the slider position to match
  const sliderValue = timeScale(currentDate);
  document.getElementById('commit-progress').value = sliderValue;
  
  // Update the time display
  const date = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const time = currentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  document.getElementById('commit-time').textContent = `${date} at ${time}`;
}

// Initialize second scrollama instance
const fileScroller = scrollama();
fileScroller
  .setup({
    container: '#scrolly-2',
    step: '#scrolly-2 .step',
    offset: 0.6,
    debug: false
  })
  .onStepEnter(onFileStepEnter)
  .onStepExit(response => {
    // Remove the active class when exiting a step
    d3.select(response.element).classed('is-active', false);
  });

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const GITHUB_REPO = 'vipra-b/portfolio';

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
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const ret = {
        id: commit,
        url: `https://github.com/${GITHUB_REPO}/commit/${commit}`,
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
        configurable: true,
        writable: false,
      });
      return ret;
    });
}

function renderCommitInfo(data, commits) {
  const numFiles = d3.group(data, (d) => d.file).size;
  const numAuthors = d3.group(data, (d) => d.author).size;
  const avgLineLen = d3.mean(data, (d) => d.length);

  const fileLineCounts = d3.rollups(
    data,
    (v) => d3.max(v, (row) => row.line),
    (d) => d.file,
  );
  const longestFile = d3.greatest(fileLineCounts, (d) => d[1]);

  const workByWeekday = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { weekday: 'long' }),
  );
  const busiestDay = d3.greatest(workByWeekday, (d) => d[1])?.[0] ?? '—';

  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('Files tracked');
  dl.append('dd').text(numFiles);

  dl.append('dt').text('Contributors');
  dl.append('dd').text(numAuthors);

  dl.append('dt').text('Avg line length');
  dl.append('dd').text(
    avgLineLen != null ? `${avgLineLen.toFixed(1)} chars` : '—',
  );

  dl.append('dt').text('Longest file');
  dl.append('dd').text(
    longestFile ? `${longestFile[0]} (${longestFile[1]} lines)` : '—',
  );

  dl.append('dt').text('Busiest weekday');
  dl.append('dd').text(busiestDay);
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const timeEl = document.getElementById('commit-time');
  const authorEl = document.getElementById('commit-author');
  const linesEl = document.getElementById('commit-lines');

  if (!commit || Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  timeEl.textContent =
    commit.datetime?.toLocaleString('en', { timeStyle: 'short' }) ?? '';
  authorEl.textContent = commit.author ?? '';
  linesEl.textContent = String(commit.totalLines ?? '');
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

function isCommitSelected(selection, commit, xScale, yScale) {
  if (!selection) return false;
  const cx = xScale(commit.datetime);
  const cy = yScale(commit.hourFrac);
  const [[x0, y0], [x1, y1]] = selection;
  const xmin = Math.min(x0, x1);
  const xmax = Math.max(x0, x1);
  const ymin = Math.min(y0, y1);
  const ymax = Math.max(y0, y1);
  return cx >= xmin && cx <= xmax && cy >= ymin && cy <= ymax;
}

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 46 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines ?? 0, maxLines ?? 1])
    .range([2, 30]);

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickFormat('')
        .tickSize(-usableArea.width),
    );

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => `${String(d % 24).padStart(2, '0')}:00`);

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const defaultFill = 'steelblue';
  const selectedFill = '#ff6b6b';

  /** Commits inside the brush rectangle (empty if no brush). */
  let brushSelection = null;
  /** Commit ids toggled by clicking dots (union with brush). */
  const manuallySelectedIds = new Set();

  function highlightedCommitSet() {
    const ids = new Set(manuallySelectedIds);
    if (brushSelection) {
      for (const d of commits) {
        if (isCommitSelected(brushSelection, d, xScale, yScale)) {
          ids.add(d.id);
        }
      }
    }
    return ids;
  }

  function commitsFromIds(ids) {
    return commits.filter((d) => ids.has(d.id));
  }

  function syncSelectionUi() {
    const ids = highlightedCommitSet();
    const selectedList = commitsFromIds(ids);

    svg.selectAll('.dots circle').each(function (d) {
      const on = ids.has(d.id);
      const dot = d3.select(this);
      dot.classed('selected', on).attr('fill', on ? selectedFill : defaultFill);
      dot.style('fill-opacity', on ? 1 : 0.7);
    });

    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${selectedList.length || 'No'} commits selected`;

    const container = document.getElementById('language-breakdown');
    if (selectedList.length === 0) {
      container.innerHTML = '';
      return;
    }

    const lines = selectedList.flatMap((d) => d.lines);
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (row) => row.type,
    );

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

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', defaultFill)
    .style('fill-opacity', 0.7)
    .on('click', (event, d) => {
      event.stopPropagation();
      if (manuallySelectedIds.has(d.id)) {
        manuallySelectedIds.delete(d.id);
      } else {
        manuallySelectedIds.add(d.id);
      }
      syncSelectionUi();
    })
    .on('mouseenter', (event, commit) => {
      const dot = d3.select(event.currentTarget);
      dot.style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      const dot = d3.select(event.currentTarget);
      dot.style('fill-opacity', dot.classed('selected') ? 1 : 0.7);
      updateTooltipVisibility(false);
    });

  function brushed(event) {
    brushSelection = event.selection;
    syncSelectionUi();
  }

  svg
    .call(
      d3
        .brush()
        .extent([
          [usableArea.left, usableArea.top],
          [usableArea.right, usableArea.bottom],
        ])
        .on('start brush end', brushed),
    );

  svg.selectAll('.dots, .overlay ~ *').raise();

  syncSelectionUi();

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    manuallySelectedIds.clear();
    syncSelectionUi();
  });
}

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

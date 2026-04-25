import { fetchJSON, renderProjects, fetchGithubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');

renderProjects(latestProjects, projectsContainer, 'h2');

const githubData = await fetchGithubData('vipra-b');
const profileStatsContent = document.querySelector(
  '#profile-stats .profile-stats__content',
);

if (profileStatsContent && githubData) {
  profileStatsContent.innerHTML = `
    <dl>
      <dt>Public Repos</dt>
      <dt>Public Gists</dt>
      <dt>Followers</dt>
      <dt>Following</dt>
      <dd>${githubData.public_repos}</dd>
      <dd>${githubData.public_gists}</dd>
      <dd>${githubData.followers}</dd>
      <dd>${githubData.following}</dd>
    </dl>
  `;
}

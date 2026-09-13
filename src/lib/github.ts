/** Only the fields IdeaSpace reads. The GitHub REST payloads are much larger. */
interface GitHubUser {
  public_repos: number
  followers: number
}

interface GitHubRepo {
  name: string
  language: string | null
  size?: number
  stargazers_count: number
  description: string | null
  html_url: string
}

export async function fetchGithubData(username: string) {
  const headers = { 
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'IdeaSpace-Lendi'
  }
  
  // Try to use PAT if available to avoid rate limits
  if (process.env.GITHUB_PAT) {
    Object.assign(headers, { 'Authorization': `token ${process.env.GITHUB_PAT}` })
  }
  
  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=5`, { headers })
    ])
    
    if (!userRes.ok) throw new Error('GitHub user not found')
    
    const user = (await userRes.json()) as GitHubUser
    const repos = (await reposRes.json()) as GitHubRepo[]
    
    // Aggregate languages
    const languageCounts: Record<string, number> = {}
    for (const repo of repos) {
      if (repo.language) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + (repo.size || 1)
      }
    }
    
    const totalSize = Object.values(languageCounts).reduce((a, b) => a + b, 0)
    const languages = Object.entries(languageCounts)
      .map(([lang, size]) => ({ lang, percentage: Math.round((size / totalSize) * 100) }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5)
    
    return {
      username,
      publicRepos: user.public_repos,
      followers: user.followers,
      topRepos: repos.slice(0, 3).map((r) => ({
        name: r.name,
        stars: r.stargazers_count,
        language: r.language,
        description: r.description,
        url: r.html_url,
      })),
      languages,
      syncedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error("Failed fetching GitHub Data", error)
    return null
  }
}

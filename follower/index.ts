import { promises as fs } from 'fs'
import path from 'path'
import { request } from '@octokit/request'
import { compilePSVG } from '@lingdong/psvg'
import imageDataURI from 'image-data-uri'

interface RawFollower {
  login: string
  avatar_url: string
  html_url: string
}

interface Follower {
  username: string
  url: string
  avatar: string
}

const fetchUserData = async (user: RawFollower) => {
  const avatar = await imageDataURI.encodeFromURL(user.avatar_url)
  const result: Follower = {
    username: user.login,
    url: user.html_url,
    avatar,
  }
  console.log(`fetched ${user.login}`)
  return result
}

const getFollowers = async (username: string) => {
  let page = 1
  let rawFollowers: RawFollower[] = []
  while (true && page < 50) {
    console.log(`fetching page ${page}`)
    const response = await request(`GET /users/${username}/followers`, { page })
    rawFollowers = rawFollowers.concat(response.data)
    if (response.headers.link) {
      const link = response.headers.link
      if (link.includes('rel="next"')) {
        page++
      } else {
        break
      }
    } else {
      break
    }
  }
  
  const followers = await Promise.all(rawFollowers.map(async item => {
    return await fetchUserData(item)
  }))
  return followers
}

const generateSvg = async (list: Follower[]) => {
  let template = await fs.readFile(path.join(__dirname, 'template.psvg'), 'utf8')

  template = template.replace(/__FOLLOWER_COUNT__/g, list.length.toString())
  template = template.replace(/__AVATAR_LIST__/g, list.map(item => item.avatar.replace(',', '@')).join(' '))
  template = template.replace(/__LINK_LIST__/g, list.map(item => item.url).join(' '))
  template = template.replace(/__CURRENT_TIME__/g, new Date().toUTCString())

  const transformedSvg = compilePSVG(template)
  const svgFilePath = path.join(__dirname, '../assets/', 'followers.svg')
  await fs.writeFile(svgFilePath, transformedSvg, 'utf-8')
}

const main = async () => {
  const followerList = await getFollowers('ddiu8081')
  generateSvg(followerList)
}

main()
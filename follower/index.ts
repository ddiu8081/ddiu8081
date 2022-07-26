import { promises as fs } from 'fs'
import path from 'path'
import { $fetch } from 'ohmyfetch'
import { request } from '@octokit/request'
import { compilePSVG } from '@lingdong/psvg'
import imageDataURI from 'image-data-uri'
import sharp from 'sharp'

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

function toBuffer(ab: ArrayBuffer) {
  const buf = Buffer.alloc(ab.byteLength)
  const view = new Uint8Array(ab)
  for (let i = 0; i < buf.length; ++i)
    buf[i] = view[i]

  return buf
}

const fetchUserData = async (user: RawFollower) => {
  const avatarData = await $fetch(user.avatar_url, { responseType: 'arrayBuffer' })
  const sharpImgData = await sharp(toBuffer(avatarData)).resize(60, 60).blur(20).png({ quality: 80, compressionLevel: 8 }).toBuffer()
  const avatar = await imageDataURI.encode(sharpImgData, 'PNG')
  const result: Follower = {
    username: user.login,
    url: user.html_url,
    avatar,
  }
  const isSuccess = avatar ? true : false
  console.log(`fetched ${user.login} ${isSuccess ? 'success' : 'fail'}`)
  return result
}

const getFollowers = async (username: string) => {
  let page = 1
  let rawFollowers: RawFollower[] = []
  while (true && page < 50) {
    console.log(`fetching page ${page}`)
    const response = await request(`GET /users/${username}/followers`, { page, per_page: 100 })
    rawFollowers = rawFollowers.concat(response.data)
    console.log(`fetched ${response.data.length} users`)
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

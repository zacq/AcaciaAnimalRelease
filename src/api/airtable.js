import axios from 'axios'

const BASE_URL = 'https://api.airtable.com/v0'
const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY

const client = axios.create({
  baseURL: `${BASE_URL}/${BASE_ID}`,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.error('Airtable: unauthorized — check API key')
    } else if (err.response?.status === 429) {
      console.error('Airtable: rate limited')
    }
    return Promise.reject(err)
  }
)

export default client

const CacheData = {}

export const getCacheKey = config => {
  let cacheKey = config.baseURL + config.url
  if (config.params) {
    const params = config.params
    const objKeys = Object.keys(params)
    objKeys.sort()
    objKeys.forEach(key => {
      cacheKey = cacheKey + '&' + key + '=' + params[key]
    })
  }
  return cacheKey
}

export const setCacheData = (key, data) => {
  CacheData[key] = JSON.parse(JSON.stringify(data))
}

export const getCacheData = key => {
  const res = CacheData[key]
  return res ? JSON.parse(JSON.stringify(res)) : null
}

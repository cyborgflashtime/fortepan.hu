import { slugify } from "../../utils"

const elasticRequest = body => {
  const searchHost = "http://fortepan:fortepan@v39241.php-friends.de:9200/elasticsearch_index_fortepan_media/_search"

  // Perform the request.
  const xmlHttp = new XMLHttpRequest()
  xmlHttp.open("POST", searchHost, false)
  xmlHttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8")
  xmlHttp.send(JSON.stringify(body))

  return JSON.parse(xmlHttp.responseText)
}

export const search = params => {
  const query = {
    bool: {
      must: [],
      should: [],
    },
  }

  let sort = [{ year: { order: "asc" } }, { created: { order: "desc" } }]

  const range = {
    range: {
      year: {
        gt: 0,
      },
    },
  }

  // returns all records when query field is empty
  if (!params || (params && params.q === "")) {
    query.bool.must.push({ match_all: {} })
  }

  if (params.latest === "") {
    query.bool.must.push({
      range: {
        created: {
          gt: 1581638400,
        },
      },
    })

    sort = [{ year: { order: "asc" } }, { created: { order: "desc" } }]
  }

  // if query (search term) exists
  // then it'll search matches in name, description, orszag_name, cimke_name, and varos_name fields
  // SHOULD means "OR" in elastic
  if (params.q && params.q !== "") {
    const q = slugify(params.q)
    // query.bool.must.push({ match_phrase: { description_search: `${q}` } })
    query.bool.must.push({
      multi_match: {
        query: `${q}`,
        fields: ["mid^5", "year^2", "*_search"],
        type: "most_fields",
        lenient: true,
        operator: "and",
      },
    })
  }

  // if there's a tag search attribute defined (advanced search)
  if (params.tag) {
    const tag = slugify(params.tag)
    query.bool.must.push({ term: { cimke_search: `${tag}` } })
  }

  // if there's a year search attribute defined (advanced search)
  if (params.year) {
    query.bool.must.push({ term: { year: `${params.year}` } })
  }

  // if there's a city search attribute defined (advanced search)
  if (params.place) {
    const place = slugify(params.place)
    query.bool.must.push({ term: { helyszin_search: `${place}` } })
  }

  // if there's a city search attribute defined (advanced search)
  if (params.city) {
    const city = slugify(params.city)
    query.bool.must.push({ term: { varos_search: `${city}` } })
  }

  // if there's a country search attribute defined (advanced search)
  if (params.country) {
    const country = slugify(params.country)
    query.bool.must.push({ term: { orszag_search: `${country}` } })
  }

  // if there's a donor search attribute defined (advanced search)
  if (params.donor) {
    const donor = slugify(params.donor)
    query.bool.must.push({ term: { adomanyozo_search: `${donor}` } })
  }

  // if there's an id search attribute defined (advanced search)
  if (params.id) {
    const id = slugify(params.id)
    query.bool.must.push({ term: { mid: `${id}` } })
  }

  // if there's a year range defined (advanced search / range filter)
  if (params.year_from || params.year_to) {
    const y = {}
    if (params.year_from) y.gte = params.year_from
    if (params.year_to) y.lte = params.year_to
    range.range.year = y
  }

  query.bool.must.push(range)

  const body = {
    from: params.from || 0,
    size: params.size || 30,
    sort,
    track_total_hits: true,
    query,
  }

  const response = elasticRequest(body)
  console.log(response)
}

export const total = () => {
  const body = {
    size: 0,
    track_total_hits: true,
    query: {
      bool: {
        must: [
          {
            match_all: {},
          },
          {
            range: {
              year: {
                gt: 0,
              },
            },
          },
        ],
      },
    },
  }

  const response = elasticRequest(body)
  console.log(response)
}
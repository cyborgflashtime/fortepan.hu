import throttle from "lodash/throttle"
import config from "../../config"
import { ready, trigger, getURLParams, numberWithCommas } from "../../utils"
import Timeline from "../../components/timeline/timeline"
import search from "../../components/api/search"

const THUMBNAIL_HEIGHT = 160

let photosNode = null
let selectedThumbnail = null
let thumbnailsCount = 0
let thumbnailsLoading = false

const isThumbnailInViewport = el => {
  if (el) {
    const bounds = el.getBoundingClientRect()
    return bounds.top >= document.querySelector(".header").offsetHeight && bounds.bottom <= window.innerHeight
  }
  return false
}

const setTitle = photosCount => {
  const q = getURLParams()
  const titleNode = document.querySelector(".photos__title")

  // set page title
  if (typeof q.latest !== "undefined") {
    titleNode.textContent = titleNode.dataset.latestLabel
  } else if (Object.keys(q).length === 0 || !q.q || (q.q === "" && !q.latest === "")) {
    titleNode.textContent = titleNode.dataset.photosLabel
  } else {
    titleNode.textContent = titleNode.dataset.searchLabel
  }

  // set search expression tag content
  const searchExpressionNode = document.querySelector("#PhotosSearchExpression")
  if (Object.keys(q).length === 0 || q.q === "" || Object.keys(q).indexOf("latest") > -1) {
    searchExpressionNode.classList.remove("photos__subtitle__expression--show")
  } else if (Object.keys(q).indexOf("donor") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.donorLabel}: <em>${q.donor}</em>`
  } else if (Object.keys(q).indexOf("year") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.yearLabel}: <em>${q.year}</em>`
  } else if (Object.keys(q).indexOf("country") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.countryLabel}: <em>${q.country}</em>`
  } else if (Object.keys(q).indexOf("city") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.cityLabel}: <em>${q.city}</em>`
  } else if (Object.keys(q).indexOf("place") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.placeLabel}: <em>${q.place}</em>`
  } else if (Object.keys(q).indexOf("tag") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.tagLabel}: <em>${q.tag}</em>`
  } else if (Object.keys(q).indexOf("q") > -1) {
    searchExpressionNode.classList.add("photos__subtitle__expression--show")
    searchExpressionNode.innerHTML = `${searchExpressionNode.parentNode.dataset.qLabel}: <em>${q.q}</em>`
  }

  document.querySelector("#PhotosCount").textContent = numberWithCommas(photosCount)
  document.querySelector(".photos__subtitle").classList.add("photos__subtitle--show")
}

const resizeThumbnail = thumbnail => {
  const t = thumbnail
  const i = t.querySelector(".photos__thumbnail__image")
  const h = window.innerWidth < 640 ? (THUMBNAIL_HEIGHT * 2) / 3 : THUMBNAIL_HEIGHT
  if (!i.dataset.naturalWidth) return
  i.style.height = `${h}px`
  const w = (i.dataset.naturalWidth / i.dataset.naturalHeight) * h
  t.style.flex = `${w}`
  t.style.minWidth = `${w}px`
}

const Thumbnail = data => {
  // eslint-disable-next-line no-underscore-dangle
  const d = data._source
  const t = document.createRange().createContextualFragment(document.getElementById("Thumbnail").innerHTML)

  // Fill template with data
  const locationArray = []
  if (d.year) locationArray.push(d.year)
  if (d.varos_name) locationArray.push(d.varos_name)
  if (d.helyszin_name) locationArray.push(d.helyszin_name)
  if (!d.varos_name && !d.helyszin_name && d.orszag_name) locationArray.push(d.orszag_name)
  t.querySelector(".photos__thumbnail__meta--location").textContent = locationArray.join(" · ")
  t.querySelector(".photos__thumbnail__meta--description").textContent = d.description ? d.description : ""

  const img = new Image()
  const imgContainer = t.querySelector(".photos__thumbnail__image")

  img.addEventListener("load", e => {
    const i = e.target
    imgContainer.style.backgroundImage = `url("${e.target.currentSrc}")`
    imgContainer.dataset.naturalWidth = i.naturalWidth
    imgContainer.dataset.naturalHeight = i.naturalHeight

    imgContainer.parentNode.classList.add("photos__thumbnail--display")

    setTimeout(() => {
      imgContainer.parentNode.classList.add("photos__thumbnail--show")
    }, 100)

    resizeThumbnail(imgContainer.parentNode)
  })
  img.srcset = `${config.PHOTO_SOURCE}240/fortepan_${d.mid}.jpg 1x, ${config.PHOTO_SOURCE}480/fortepan_${d.mid}.jpg 2x`
  img.src = `${config.PHOTO_SOURCE}240/fortepan_${d.mid}.jpg`

  // Bind events
  t.querySelector(".photos__thumbnail").addEventListener("click", e => {
    // Highlight selected thumbnail
    if (selectedThumbnail) selectedThumbnail.classList.remove("photos__thumbnail--selected")
    selectedThumbnail = e.currentTarget
    selectedThumbnail.classList.add("photos__thumbnail--selected")

    d.elIndex = Array.prototype.indexOf.call(e.currentTarget.parentElement.children, e.currentTarget) + 1

    console.log(d)

    // Load photo in Carousel
    trigger("carousel:loadPhoto", d)
  })

  return t
}

const loadPhotos = () => {
  return new Promise((resolve, reject) => {
    const wrapperNode = photosNode.querySelector(".photos__wrapper")

    const params = {}
    const defaultParams = {
      size: config.THUMBNAILS_QUERY_LIMIT,
      from: thumbnailsCount,
    }

    const urlParams = getURLParams()
    Object.assign(params, defaultParams, urlParams)

    Timeline.init(params.year_from, params.year_to)

    if (params.year) {
      Timeline.disable()
    }

    // clear search fields if query is not defined in the request
    if (!params.q) {
      trigger("search:clear")
    } else {
      trigger("search:setValue", { value: params.q })
    }

    search.search(
      params,
      data => {
        console.log(data)
        setTitle(data.hits.total.value)
        data.hits.hits.forEach(itemData => {
          thumbnailsCount += 1
          const thumbnailFragment = new Thumbnail(itemData)
          wrapperNode.appendChild(thumbnailFragment)
        })
        thumbnailsLoading = false
        resolve()
      },
      statusText => {
        reject(statusText)
      }
    )
  })
}

const resizeThumbnails = () => {
  const thumbnails = photosNode.querySelectorAll(".photos__thumbnail")
  Array.from(thumbnails).forEach(el => {
    resizeThumbnail(el)
  })
}

ready(() => {
  // Find photosNode
  photosNode = document.querySelector(".photos")
  if (!photosNode) return

  // Bind window events
  window.addEventListener("resize", throttle(resizeThumbnails, 1000))

  // Bind custom events
  // select next photo and open carousel
  document.addEventListener("photos:showNextPhoto", () => {
    let next = selectedThumbnail.nextElementSibling
    if (next) {
      trigger("carousel:hidePhotos")
      next.click()
    } else if (thumbnailsCount % config.THUMBNAILS_QUERY_LIMIT === 0) {
      thumbnailsLoading = true
      loadPhotos().then(() => {
        next = selectedThumbnail.nextElementSibling
        if (next) {
          trigger("carousel:hidePhotos")
          next.click()
        }
      })
    }
  })
  // select previous photo and open carousel
  document.addEventListener("photos:showPrevPhoto", () => {
    const prev = selectedThumbnail.previousElementSibling
    if (prev) {
      trigger("carousel:hidePhotos")
      prev.click()
    }
  })
  // when carousel gets closed...
  document.addEventListener("carousel:hide", () => {
    // ...scroll to thumbnail if it's not in the viewport
    if (selectedThumbnail) {
      if (!isThumbnailInViewport(selectedThumbnail.querySelector(".photos__thumbnail__image"))) {
        photosNode.scrollTop = selectedThumbnail.offsetTop - 16 - document.querySelector(".header").offsetHeight
      }
    }
  })

  // bind scroll event to photos container
  photosNode.addEventListener("scroll", e => {
    const view = e.target
    // add shadow to the header when people start to scroll on the page
    if (view.scrollTop > 0) {
      trigger("header:addShadow")
    } else {
      trigger("header:removeShadow")
    }

    // auto-load new items when scrolling reaches the bottom of the page
    if (
      view.scrollTop + view.offsetHeight >= view.scrollHeight &&
      !thumbnailsLoading &&
      thumbnailsCount % config.THUMBNAILS_QUERY_LIMIT === 0 &&
      thumbnailsCount > 0
    ) {
      thumbnailsLoading = true
      loadPhotos()
    }
  })

  // load photos when address bar url changes
  const onPopState = e => {
    // reset photosNode when needed
    if ((e && e.detail && e.detail.resetPhotosWrapper === true) || (e && e.type)) {
      const wrapperNode = photosNode.querySelector(".photos__wrapper")
      while (wrapperNode.firstChild) {
        wrapperNode.firstChild.remove()
      }
      photosNode.scrollTop = 0
      thumbnailsCount = 0
    }

    loadPhotos().then(() => {
      if (getURLParams().id > 0) {
        // show carousel with an image
        if (document.querySelector(".photos__thumbnail")) document.querySelector(".photos__thumbnail").click()
      } else {
        trigger("carousel:hide")
      }
    })
  }

  document.addEventListener("photos:historyPushState", e => {
    // NOTE: the next line needs to be updated when the English version launches
    window.history.pushState(null, "Keresés", e.detail.url)
    onPopState(e)
  })
  window.onpopstate = onPopState
  onPopState()
})

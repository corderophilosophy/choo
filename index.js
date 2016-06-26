const history = require('sheet-router/history')
const sheetRouter = require('sheet-router')
const document = require('global/document')
const href = require('sheet-router/href')
const hash = require('sheet-router/hash')
const hashMatch = require('hash-match')
const barracks = require('barracks')
const assert = require('assert')
const xtend = require('xtend')
const yo = require('yo-yo')

choo.view = yo
module.exports = choo

// framework for creating sturdy web applications
// null -> fn
function choo (opts) {
  opts = opts || {}
  const store = barracks({ onState: render })
  var _rootNode = null
  var _router = null

  start.toString = toString
  start.router = router
  start.model = model
  start.start = start

  return start

  // render the application to a string
  // (str, obj) -> str
  function toString (route, serverState) {
    const initialState = store.start({
      noSubscriptions: true,
      noReducers: true,
      noEffects: true
    })

    const state = xtend(initialState, serverState)
    const tree = _router(route, state, function () {
      throw new Error('send() cannot be called on the server')
    })

    return tree.toString()
  }

  // start the application
  // (str?, obj?) -> DOMNode
  function start (rootId, startOpts) {
    if (!startOpts && typeof rootId !== 'string') {
      startOpts = rootId
      rootId = null
    }
    startOpts = startOpts || {}

    store.model(appInit(startOpts))
    const send = store.start(startOpts)
    const state = store.state()
    if (rootId) {
      document.addEventListener('DOMContentLoaded', function (event) {
        rootId = rootId.replace(/^#/, '')
        const oldTree = document.querySelector('#' + rootId)
        assert.ok(oldTree, 'could not find node #' + rootId)
        const newTree = _router(state.app.location, state, send)
        _rootNode = yo.update(oldTree, newTree)
      })
    } else {
      const tree = _router(state.app.location, state, send)
      _rootNode = tree
      return tree
    }
  }

  // update the DOM after every state mutation
  // (obj, obj, obj, fn) -> null
  function render (action, state, prev, send) {
    if (opts.onState) opts.onState(action, state, prev, send)

    if (state === prev) return

    const newTree = _router(state.app.location, state, send, prev)
    _rootNode = yo.update(_rootNode, newTree)
  }

  // register all routes on the router
  // (str?, [fn|[fn]]) -> obj
  function router (defaultRoute, cb) {
    _router = sheetRouter(defaultRoute, cb)
    return _router
  }

  // create a new model
  // (str?, obj) -> null
  function model (model) {
    store.model(model)
  }
}

// initial application state model
// obj -> obj
function appInit (opts) {
  const model = {
    namespace: 'app',
    state: {
      location: (opts.hash === true)
        ? hashMatch(document.location.hash)
        : document.location.href
    },
    reducers: {
      // handle href links
      location: function setLocation (action, state) {
        return {
          location: action.location.replace(/#.*/, '')
        }
      }
    }
  }

  // if hash routing explicitly enabled, subscribe to it
  const subs = {}
  if (opts.hash === true) {
    pushLocationSub(function (navigate) {
      hash(function (fragment) {
        navigate(hashMatch(fragment))
      })
    }, 'handleHash', subs)
  } else {
    if (opts.history !== false) pushLocationSub(history, 'setLocation', subs)
    if (opts.href !== false) pushLocationSub(href, 'handleHref', subs)
  }

  model.subscriptions = subs
  return model

  // create a new subscription that modifies
  // 'app:location' and push it to be loaded
  // (fn, obj) -> null
  function pushLocationSub (cb, key, model) {
    model[key] = function (send) {
      cb(function navigate (href) {
        send('app:location', { location: href })
      })
    }
  }
}

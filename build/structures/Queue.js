const { AqualinkEvents } = require('./AqualinkEvents')

class Queue {
  constructor(player = null) {
    this._items = []
    this._head = 0
    this._compactThreshold = 64
    this.player = player
    this._updateScheduled = false
  }

  _emitQueueUpdate() {
    const player = this.player
    if (!player || player.destroyed) return
    if (this._updateScheduled) return
    this._updateScheduled = true
    queueMicrotask(() => {
      this._updateScheduled = false
      if (!player || player.destroyed) return
      try {
        const event = AqualinkEvents?.QueueUpdate || 'queueUpdate'
        player.emit?.(event, player, this)
        if (player.aqua) {
          player.aqua.emit(event, player, this)
        }
      } catch { }
    })
  }

  get size() {
    return this._items.length - this._head
  }

  get first() {
    return this._items[this._head] || null
  }

  get last() {
    return this._items[this._items.length - 1] || null
  }

  add(...tracks) {
    if (!tracks?.length) return this
    let added = false
    if (tracks.length === 1 && Array.isArray(tracks[0])) {
      const valid = tracks[0].filter(Boolean)
      if (valid.length) {
        this._items.push(...valid)
        added = true
      }
    } else {
      for (const track of tracks) {
        if (Array.isArray(track)) {
          const valid = track.filter(Boolean)
          if (valid.length) {
            this._items.push(...valid)
            added = true
          }
        } else if (track) {
          this._items.push(track)
          added = true
        }
      }
    }
    if (added) this._emitQueueUpdate()
    return this
  }

  remove(track) {
    const idx = this._items.indexOf(track, this._head)
    if (idx === -1) return false
    const removed = this._items[idx]
    this._items.splice(idx, 1)
    if (removed?.dispose) removed.dispose()
    this._emitQueueUpdate()
    return true
  }

  clear() {
    const hadItems = this.size > 0
    for (let i = this._head; i < this._items.length; i++) {
      if (this._items[i]?.dispose) this._items[i].dispose()
    }
    this._items.length = 0
    this._head = 0
    if (hadItems) this._emitQueueUpdate()
  }

  _compact(force = false) {
    if (this._head <= 0) return
    if (!force && this._head < this._compactThreshold) return
    const len = this._items.length - this._head
    if (len <= 0) {
      this._items.length = 0
      this._head = 0
      return
    }
    for (let i = 0; i < len; i++) {
      this._items[i] = this._items[this._head + i]
    }
    this._items.length = len
    this._head = 0
    if (this._compactThreshold < len) {
      this._compactThreshold = Math.min(len * 2, 1024)
    }
  }

  shuffle() {
    if (this.size <= 1) return this
    this._compact(true)
    for (let i = this._items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = this._items[i]
      this._items[i] = this._items[j]
      this._items[j] = temp
    }
    this._emitQueueUpdate()
    return this
  }

  move(from, to) {
    if (from === to) return this
    const actualFrom = from + this._head
    const actualTo = to + this._head
    if (
      from < 0 ||
      actualFrom >= this._items.length ||
      to < 0 ||
      actualTo >= this._items.length
    )
      return this
    const [item] = this._items.splice(actualFrom, 1)
    this._items.splice(actualTo, 0, item)
    this._emitQueueUpdate()
    return this
  }

  swap(index1, index2) {
    if (index1 === index2) return this
    const actual1 = index1 + this._head
    const actual2 = index2 + this._head
    if (
      index1 < 0 ||
      actual1 >= this._items.length ||
      index2 < 0 ||
      actual2 >= this._items.length
    )
      return this
    const temp = this._items[actual1]
    this._items[actual1] = this._items[actual2]
    this._items[actual2] = temp
    this._emitQueueUpdate()
    return this
  }

  peek() {
    return this.first
  }

  toArray() {
    return this._items.slice(this._head)
  }

  at(index) {
    return this._items[this._head + index] || null
  }

  dequeue() {
    if (this._head >= this._items.length) return undefined
    const item = this._items[this._head]
    this._items[this._head] = undefined // Allow GC
    this._head++
    this._compact(false)
    this._emitQueueUpdate()
    return item
  }

  isEmpty() {
    return this.size === 0
  }

  enqueue(track) {
    return this.add(track)
  }
}

module.exports = Queue

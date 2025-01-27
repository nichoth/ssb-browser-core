const test = require('tape')
const pull = require('pull-stream')

const dir = '/tmp/ssb-browser-partial'

require('rimraf').sync(dir)

require('../core.js').init(dir)

SSB.on('SSB: loaded', function() {
  test('Base', t => {
    const post = { type: 'post', text: 'Testing!' }

    SSB.db.publish(post, (err, postMsg) => {
      SSB.db.onDrain('ebt', () => {
        pull(
          SSB.createHistoryStream({ id: SSB.id, keys: false }),
          pull.collect((err, results) => {
            t.equal(results.length, 1)
            // values directly
            t.equal(results[0].content.text, post.text)
            t.end()
          })
        )
      })
    })
  })
  
  test('Keys', t => {
    pull(
      SSB.createHistoryStream({ id: SSB.id }),
      pull.collect((err, results) => {
        t.equal(results.length, 1)
        t.equal(typeof results[0].key, 'string')
        t.end()
      })
    )
  })

  test('No values', t => {
    pull(
      SSB.createHistoryStream({ id: SSB.id, values: false }),
      pull.collect((err, results) => {
        t.equal(results.length, 1)
        t.equal(typeof results[0], 'string')
        t.end()
      })
    )
  })
  
  test('Seq', t => {
    pull(
      SSB.createHistoryStream({ id: SSB.id, keys: false, seq: 1 }),
      pull.collect((err, results) => {
        t.equal(results.length, 1)

        pull(
          SSB.createHistoryStream({ id: SSB.id, keys: false, seq: 0 }),
          pull.collect((err, results) => {
            t.equal(results.length, 1)

            const post = { type: 'post', text: 'Testing 2' }
            SSB.db.publish(post, (err, postMsg) => {
              SSB.db.onDrain(() => {
                pull(
                  SSB.createHistoryStream({ id: SSB.id, keys: false, seq: 2 }),
                  pull.collect((err, results) => {
                    t.equal(results.length, 1)
                    t.equal(results[0].content.text, post.text)
                    
                    pull(
                      SSB.createHistoryStream({ id: SSB.id, keys: false, seq: 1, limit: 1 }),
                      pull.collect((err, results) => {
                        t.equal(results.length, 1)
                        t.equal(results[0].content.text, 'Testing!')
                        
                        t.end()
                      })
                    )
                  })
                )
              })
            })
          })
        )
      })
    )
  })
  
  test('Encrypted', t => {
    var content = { type: 'post', text: 'super secret', recps: [SSB.id] }
    content = SSB.helpers.box(content, content.recps.map(x => x.substr(1)))
    
    SSB.db.publish(content, (err, privateMsg) => {
      SSB.db.onDrain(() => {
        pull(
          SSB.createHistoryStream({ id: SSB.id, keys: false }),
          pull.collect((err, results) => {
            t.equal(results.length, 3)
            t.equal(typeof results[2].content, 'string')
            t.end()
          })
        )
      })
    })
  })

  test('getTangle', t => {
    var content = { type: 'post', text: 'Thread' }

    SSB.db.publish(content, (err, threadMsg) => {
      var reply = { type: 'post', text: 'Thread msg', root: threadMsg.key, branch: threadMsg.key }
      SSB.db.publish(reply, (err, replyMsg) => {
        SSB.db.onDrain(() => {
          SSB.partialReplication.getTangle(threadMsg.key, (err, results) => {
            t.error(err, 'no err')
            t.equal(results.length, 2)
            t.equal(results[0].content.text, content.text)
            t.equal(results[1].content.text, reply.text)
            t.end()
          })
        })
      })
    })
  })

  test('getTangle private', t => {
    var content = { type: 'post', text: 'Private thread', recps: [SSB.id] }
    content = SSB.helpers.box(content, content.recps.map(x => x.substr(1)))

    SSB.db.publish(content, (err, threadMsg) => {
      var reply = { type: 'post', text: 'Thread msg', root: threadMsg.key, branch: threadMsg.key,
                    recps: [SSB.id] }
      reply = SSB.helpers.box(reply, reply.recps.map(x => x.substr(1)))
      SSB.db.publish(reply, (err, replyMsg) => {
        SSB.db.onDrain(() => {
          SSB.partialReplication.getTangle(threadMsg.key, (err, results) => {
            t.equal(results.length, 1, "only the original message")
            t.equal(results[0].text, content.text)
            t.end()
          })
        })
      })
    })
  })
})

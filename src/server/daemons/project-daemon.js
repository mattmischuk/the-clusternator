'use strict';

/**
 * Watches for project tags on cloud services and adds project databases to
 * keep them tracked
 * @module server/daemons/project-daemon
 */

const DAEMON = 'AWS Project Daemon';

const Q = require('q');
const util = require('../../util');
const constants = require('../../constants');
const POLL_INTERVAL = 30000;

const info = util.partial(util.info, DAEMON);
const debug = util.partial(util.debug, DAEMON);
const users = require('../auth/users');

let intervalId = null;

module.exports = watchForExisting;

watchForExisting.getDefaultRepo = getDefaultRepo;
watchForExisting.checkPrefix = checkPrefix;
watchForExisting.createEntry = createEntry;
watchForExisting.populateFromAws = populateFromAws;
watchForExisting.mapAwsPopulationPromise = mapAwsPopulationPromise;

/**
 * Watches for existing databases returns
 * Returns a function that will cancel the watch
 * @param {ProjectManager} pm
 * @param {function(string, *=)} db
 * @param {{ token: string, protocol: string, prefix: string }} defaultRepo
 * @param {number=} interval optional interval to override default
 * @returns {stop}
 */
function watchForExisting(pm, db, defaultRepo, interval) {
  if (intervalId) {
    return stop;
  }
  info('Starting to watch for Clusternator tagged AWS resources');

  interval = interval || POLL_INTERVAL;

  intervalId =
    setInterval(() => populateFromAws(pm, db, defaultRepo), interval);

  /**
   * stops the watch
   */
  function stop() {
    if (intervalId) {
      info('Clusternator AWS watch is stopped');
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return stop;
}

function newProjectUser(id){
  const password = Math.random() + (+Date.now()).toString(16);
  return users.create({
    id: constants.PROJECT_USER_TAG + id,
    password: password,
    authority: 0
  });
}

/**
 * @param {function(...)} db
 * @param {string} name
 * @param {string} defaultRepo
 * @returns {promiseToCreateEntry}
 */
function createEntry(db, name, defaultRepo) {
  /**
   * @returns {Promise}
   */
  function promiseToCreateEntry() {
    info(`creating entry ${name}`);
    return db({
        id: name,
        repo: getDefaultRepo(defaultRepo, name)
      })();
  }
  return promiseToCreateEntry;
}


/**
 * @param {function(...)} db
 * @param {{ token: string, protocol: string, prefix: string }} defaultRepo
 * @returns {function(string):Promise}
 */
function mapAwsPopulationPromise(db, defaultRepo) {
  return (name) => {
    debug(`promising to check for ${name}`);
    return db(name)()
      .then((r) => {
        if (!r) {
          throw new Error(`no database entry for ${name}`);
        }
        debug(`found database entry for ${name}`);
      })
      .fail(() => createEntry(db, name, defaultRepo)()
        .then(() => newProjectUser(name))
        .then(() => info(`Found Resources For Project: ${name} but no ` +
          `database entry.  Added new db entry for ${name}`))
        .fail((err) => info(`Found Resources For Project: ${name} but no ` +
          `database entry. Failed: ${err.message}`)
        )
      );
  };
}

/**
 *
 * @param {ProjectManager} pm
 * @param {function(...)} db
 * @param {{ token: string, protocol: string, prefix: string }} defaultRepo
 * @returns {Promise.<T>}
 */
function populateFromAws(pm, db, defaultRepo) {
  info('Checking AWS');
  return pm
    .listProjects()
    .then((list) => Q.all([list
      .map(mapAwsPopulationPromise(db, defaultRepo) )]))
    .fail((err)=> info(`Error watching AWS projects: ${err.message}`));
}

/**
 * @param {string} prefix
 * @returns {string}
 */
function checkPrefix(prefix) {
  if (!prefix || prefix.length < 1) {
    return 'github.com/set-config-default-repo-prefix/';
  }
  return prefix[prefix.length - 1] === '/' ? prefix : prefix + '/';
}

/**
 * @param {{ token: string, protocol: string, prefix: string }} defaultRepo
 * @param {string} name
 * @returns {string}
 */
function getDefaultRepo(defaultRepo, name) {
  if (!defaultRepo) {
    throw new Error('Projects: Default repository not configured');
  }
  const secret = defaultRepo.token ?
  defaultRepo.token + '@' : '';

  return defaultRepo.protocol + secret +
    checkPrefix(defaultRepo.prefix) + name + '.git';
}


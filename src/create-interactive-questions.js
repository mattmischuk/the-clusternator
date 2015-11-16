'use strict';

function truthy(value) {
  return value ? true : false;
}

/**
 * @param {Object} defaults
 * @returns {[]}
 */
function mandatory(defaults) {
  defaults = defaults || {};

  return [
    {
      type: 'input',
      name: 'projectId',
      message: 'Project ID',
      default: defaults.name || '',
      validate: truthy
    },
    {
      type: 'input',
      name: 'appDefPr',
      message: 'Path To App Def',
      default: defaults.appDefPr || '',
      validate: truthy
    }
  ];
}

module.exports = {
  mandatory
};
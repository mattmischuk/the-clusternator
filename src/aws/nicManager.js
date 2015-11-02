'use strict';

var Q = require('q'),
util = require('../util'),
constants = require('../constants');

function getNicManager(ec2) {
  var describe = Q.nfbind(ec2.describeNetworkInterfaces.bind(ec2), {
    DryRun: false,
    Filters: constants.AWS_FILTER_CTAG
  });


  function create(subnetId, sgIds, pid, pr) {
    var params = {
      SubnetId: subnetId,
      Groups: sgIds,
      Description: 'Created by clusternator for ' + pid + ', PR: ' + pr
    };

    return Q.nfbind(ec2.createNetworkInterface.bind(ec2), params)().
    then(function (result) {
      return util.awsTagEc2(ec2, result.NetworkInterface.NetworkInterfaceId, [
        {
          Key: constants.CLUSTERNATOR_TAG,
          Value: 'true'
        },
        {
          Key: constants.PROJECT_TAG,
          Value: pid
        },
        {
          Key: constants.PR_TAG,
          Value: pr
        }
      ]) .then(function () {
        return result;
      });
    });
  }

  function destroy(nicId, pid, pr) {
    return describe().then(function (list) {
      var nic, isValidPid = false, isValidPr = false;
      list.NetworkInterfaces.forEach(function (g){
        if (g.NetworkInterfaceId === nicId) {
          nic = g;
        }
      });

      nic.TagSet.forEach(function (tag) {
        if (tag.Key === constants.PROJECT_TAG) {
          if (tag.Value === pid) {
            isValidPid = true;
          }
        }
        if (tag.Key === constants.PR_TAG) {
          if (tag.Value === pr) {
            isValidPr = true;
          }
        }
      });

      if (!(isValidPid && isValidPr)) {
        throw new Error('No Clusternator Tagged NetworkInterfaces Available ' +
        'For Destruction With GroupId: ' + nicId + ' ProjectId: ' + pid +
        ' and PR: ' + pr);
      }

      return Q.nfbind(ec2.deleteNetworkInterface.bind(ec2), {
        NetworkInterfaceId: nicId
      })();
    });
  }

  return {
    describe: describe,
    create: create,
    destroy: destroy
  };
}


module.exports = getNicManager;
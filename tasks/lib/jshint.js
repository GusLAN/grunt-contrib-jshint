/*
 * grunt-contrib-jshint
 * http://gruntjs.com/
 *
 * Copyright (c) 2013 "Cowboy" Ben Alman, contributors
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');
var jshint = require('jshint').JSHINT;
var jshintcli = require('jshint/src/cli/cli');

exports.init = function(grunt) {
  var exports = {
    usingGruntReporter: false
  };

  // No idea why JSHint treats tabs as options.indent # characters wide, but it
  // does. See issue: https://github.com/jshint/jshint/issues/430
  var getTabStr = function(options) {
    // Do something that's going to error.
    jshint('\tx', options || {});
    // If an error occurred, figure out what character JSHint reported and
    // subtract one.
    var character = jshint.errors && jshint.errors[0] && jshint.errors[0].character - 1;
    // If character is actually a number, use it. Otherwise use 1.
    var tabsize = isNaN(character) ? 1 : character;
    // If tabsize > 1, return something that should be safe to use as a
    // placeholder. \uFFFF repeated 2+ times.
    return tabsize > 1 && grunt.util.repeat(tabsize, '\uFFFF');
  };

  var tabregex = /\t/g;

  // Select a reporter (if not using the default Grunt reporter)
  // Copied from jshint/src/cli/cli.js until that part is exposed
  exports.selectReporter = function(options) {
    switch (true) {
    // JSLint reporter
    case options.reporter === 'jslint':
    case options['jslint-reporter']:
      options.reporter = 'jshint/src/reporters/jslint_xml.js';
      break;

    // CheckStyle (XML) reporter
    case options.reporter === 'checkstyle':
    case options['checkstyle-reporter']:
      options.reporter = 'jshint/src/reporters/checkstyle.js';
      break;

    // Reporter that displays additional JSHint data
    case options['show-non-errors']:
      options.reporter = 'jshint/src/reporters/non_error.js';
      break;

    // Custom reporter
    case options.reporter !== undefined:
      options.reporter = path.resolve(process.cwd(), options.reporter);
    }

    var reporter;
    if (options.reporter) {
      try {
        reporter = require(options.reporter).reporter;
        exports.usingGruntReporter = false;
      } catch (err) {
        grunt.fatal(err);
      }
    }

    // Use the default Grunt reporter if none are found
    if (!reporter) {
      reporter = exports.reporter;
      exports.usingGruntReporter = true;
    }

    return reporter;
  };

  // Default Grunt JSHint reporter
  exports.reporter = function(results, data) {
    var msg = 'Linting' + (data[0].file ? ' ' + data[0].file : '') + '...';
    grunt.verbose.write(msg);

    if (results.length === 0) {
      // Success!
      grunt.verbose.ok();
      return;
    }

    var options = data[0].options;

    // Tab size as reported by JSHint.
    var tabstr = getTabStr(options);
    var placeholderregex = new RegExp(tabstr, 'g');

    // Something went wrong.
    grunt.verbose.or.write(msg);
    grunt.log.error();

    // Iterate over all errors.
    results.forEach(function(result) {
      var e = result.error;
      // Sometimes there's no error object.
      if (!e) { return; }
      var pos;
      var code = '';
      var evidence = e.evidence;
      var character = e.character;
      if (evidence) {
        // Manually increment errorcount since we're not using grunt.log.error().
        grunt.fail.errorcount++;
        // Descriptive code error.
        pos = '['.red + ('L' + e.line).yellow + ':'.red + ('C' + character).yellow + ']'.red;
        if (e.code) {
          code = e.code.yellow + ':'.red + ' ';
        }
        grunt.log.writeln(pos + ' ' + code + e.reason.yellow);
        // If necessary, eplace each tab char with something that can be
        // swapped out later.
        if (tabstr) {
          evidence = evidence.replace(tabregex, tabstr);
        }
        if (character === 0) {
          // Beginning of line.
          evidence = '?'.inverse.red + evidence;
        } else if (character > evidence.length) {
          // End of line.
          evidence = evidence + ' '.inverse.red;
        } else {
          // Middle of line.
          evidence = evidence.slice(0, character - 1) + evidence[character - 1].inverse.red +
            evidence.slice(character);
        }
        // Replace tab placeholder (or tabs) but with a 2-space soft tab.
        evidence = evidence.replace(tabstr ? placeholderregex : tabregex, '  ');
        grunt.log.writeln(evidence);
      } else {
        // Generic "Whoops, too many errors" error.
        grunt.log.error(e.reason);
      }
    });
    grunt.log.writeln();
  };

  // Run JSHint on the given files with the given options
  exports.lint = function(files, options, done) {
    // A list of non-dot-js extensions to check
    var extraExt = options['extra-ext'] || 'js';
    delete options['extra-ext'];

    // Select a reporter to use
    var reporter = exports.selectReporter(options);

    // Read JSHint options from a specified jshintrc file.
    if (options.jshintrc) {
      options = grunt.file.readJSON(options.jshintrc);
    }

    grunt.verbose.writeflags(options, 'JSHint options');

    // Enable/disable debugging if option explicitly set.
    if (grunt.option('debug') !== undefined) {
      options.devel = options.debug = grunt.option('debug');
      // Tweak a few things.
      if (grunt.option('debug')) {
        options.maxerr = Infinity;
      }
    }

    // Run JSHint on each file and collect results/data
    var allResults = [];
    var allData = [];
    grunt.util.async.forEach(files, function(filepath, next) {
      jshintcli.run({
        args: [filepath],
        extensions: extraExt,
        config: options,
        reporter: function(results, data) {
          reporter(results, data);
          allResults = allResults.concat(results);
          allData = allData.concat(data);
          next();
        },
        verbose: grunt.option('verbose')
      });
    }, function() {
      done(allResults, allData);
    });
  };

  return exports;
};

'use strict';

var path = require('path');
var grunt = require('grunt');
var jshint = require('../tasks/lib/jshint').init(grunt);

var fixtures = path.join(__dirname, 'fixtures');

// Helper for testing stdout
var hooker = grunt.util.hooker;
var stdoutEqual = function(callback, done) {
  var actual = '';
  // Hook process.stdout.write
  hooker.hook(process.stdout, 'write', {
    // This gets executed before the original process.stdout.write.
    pre: function(result) {
      // Concatenate uncolored result onto actual.
      actual += grunt.log.uncolor(result);
      // Prevent the original process.stdout.write from executing.
      return hooker.preempt();
    }
  });
  // Execute the logging code to be tested.
  callback();
  // Restore process.stdout.write to its original value.
  hooker.unhook(process.stdout, 'write');
  // Actually test the actually-logged stdout string to the expected value.
  done(actual);
};

exports.jshint = {
  basic: function(test) {
    test.expect(1);
    var files = [path.join(fixtures, 'missingsemicolon.js')];
    var options = {};
    jshint.lint(files, options, function(results, data) {
      test.equal(results[0].error.reason, 'Missing semicolon.', 'Should reporter a missing semicolon.');
      test.done();
    });
  },
  jshintrc: function(test) {
    test.expect(1);
    var files = [path.join(fixtures, 'nodemodule.js')];
    var options = {
      jshintrc: path.join(__dirname, '..', '.jshintrc')
    };
    jshint.lint(files, options, function(results, data) {
      test.ok(results.length === 0, 'Should not have reported any errors with supplied .jshintrc');
      test.done();
    });
  },
  defaultReporter: function(test) {
    test.expect(2);
    grunt.log.muted = false;
    var files = [path.join(fixtures, 'nodemodule.js')];
    var options = {};
    stdoutEqual(function() {
      jshint.lint(files, options, function(results, data) {});
    }, function(result) {
      test.ok(jshint.usingGruntReporter, 'Should be using the default grunt reporter.');
      test.ok(result.indexOf('[L3:C1] W117: \'module\' is not defined.') !== -1, 'Should have reported errors with the default grunt reporter.');
      test.done();
    });
  },
  alternateReporter: function(test) {
    test.expect(2);
    var files = [path.join(fixtures, 'nodemodule.js')];
    var options = {
      reporter: 'jslint'
    };
    stdoutEqual(function() {
      jshint.lint(files, options, function(results, data) {});
    }, function(result) {
      test.ok((jshint.usingGruntReporter === false), 'Should NOT be using the default grunt reporter.');
      test.ok(result.indexOf('<jslint>') !== -1, 'Should have reported errors with the jslint reporter.');
      test.done();
    });
  },
  dontBlowUp: function(test) {
    test.expect(1);
    var files = [path.join(fixtures, 'lint.txt')];
    jshint.lint(files, {}, function(results, data) {
      test.equal(results[0].error.code, 'W100', 'It should not blow up if an error occurs on character 0.');
      test.done();
    });
  },
};

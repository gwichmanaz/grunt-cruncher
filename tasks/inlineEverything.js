/*
 *
 * grunt-cruncher
 * http://github.com/zynga/grunt-cruncher
 *
 * Copyright 2013, Zynga Inc.
 * Licensed under the MIT License.
 * https://raw.github.com/zynga/grunt-cruncher/master/LICENSE-MIT
 *
 */

'use strict';

module.exports = function(grunt) {

	grunt.registerMultiTask('inlineEverything', 'Inlines everything and creates permutated files', function() {

		var done = this.async();
		var fs = require('fs');
		var path = require('path');

		// merge task-specific and/or target-specific options with these defaults.
		var options = this.options({
			relativeTo: '.',

			tags: {
				link: true,
				script: true,
				img: true
			}
		});

		function doPartialMagicToFileName(fileName, partialPath) {

			if(fileName.indexOf('{global}') > -1) {
				fileName = fileName.replace('{global}', '');
			}

			if(fileName.indexOf('{local}') > -1) {
				fileName = fileName.replace('{local}', '');
				fileName = path.join(partialPath, fileName);
			}
			
			return fileName;
		}

		function inlineLinkTags(dest, html, partialPath) {

			var sheets = [];

			var replaceFn = function(full, start, fileName, end) {
				
				// magic replacements for partials
				if(partialPath) {
					fileName = doPartialMagicToFileName(fileName, partialPath);
				}

				// if we want to omit this file, we can just return the original link tag
				if (options.filesIgnore && options.filesIgnore.includes(fileName)) {
					return full;
				}

				sheets.push(fileName);

				if(options.tags.link && typeof options.tags.link === 'function') {
					fileName = options.tags.link(fileName, null);
				}
				
				var file = fs.readFileSync(path.join(options.relativeTo, fileName), 'utf8');
				return '<style>' + file + '</style>';
			};

			var inlined;
			if(options.tags.link) {
				inlined = html.replace(/(\<link[^\>]+href\=[\"\'])(?![^\"\']*\/\/)([^\"\']+)([\"\'][^\>]*rel\=[\"\']stylesheet[\"\'][^\>]*\>)/g, replaceFn);
				inlined = inlined.replace(/(\<link[^\>]*rel\=[\"\']stylesheet[\"\'][^\>]*href\=[\"\'])(?![^\"\']*\/\/)([^\"\']+)([\"\'][^\>]*\>)/g, replaceFn);
			} else {
				inlined = html;
			}

			// remove old file if it exists..
			if(fs.existsSync(dest)) {
				fs.unlinkSync(dest);
			}

			// create all necessary directories, if needed
			grunt.file.mkdir(path.dirname(dest));

			// create compressed HTML file
			fs.writeFileSync(dest, inlined);

			if(sheets.length)
				grunt.log.writeln('  - inlined the following stylesheets: ', grunt.log.wordlist(sheets));

			grunt.log.writeln(('  - created the following build: ' + dest).green);

		}

		function getLinkFileName(fileName, engine) {

			if(typeof options.tags.link === 'function') {
				fileName = options.tags.link(fileName, engine);
			} else {
				fileName = fileName.replace(/\.css$/, '') + '.' + engine + '.css';
			}

			return path.join(options.relativeTo, fileName);
		}

		function createStylePermutedBuilds(dest, html, partialPath) {

			var sheets = [], files = [], engines = ['webkit', 'trident', 'gecko'];
			engines.forEach(function(engine, index) {

				var engineNotFound = false;

				var replaceFn = function(full, start, fileName, end) {
					
					// magic replacements for partials
					if(partialPath) {
						fileName = doPartialMagicToFileName(fileName, partialPath);
					}

					fileName = getLinkFileName(fileName, engine);

					if(!fs.existsSync(fileName)) {
						engineNotFound = true;
						return '';
					}

					var file = fs.readFileSync(fileName, 'utf8');
					return '<style>' + file + '</style>';
				};

				var permutation = html.replace(/(\<link[^\>]+href\=[\"\'])(?![^\"\']*\/\/)([^\"\']+)([\"\'][^\>]*rel\=[\"\']stylesheet[\"\'][^\>]*\>)/g, replaceFn);
				permutation = permutation.replace(/(\<link[^\>]*rel\=[\"\']stylesheet[\"\'][^\>]*href\=[\"\'])(?![^\"\']*\/\/)([^\"\']+)([\"\'][^\>]*\>)/g, replaceFn);

				// if the files haven't been located, skip that one
				if(engineNotFound) {
					return;
				}

				var newFileName = dest.replace(/\.html$/, '.' + engine + '.html');
				files.push(newFileName);

				// remove old file if it exists..
				if(fs.existsSync(newFileName)) {
					fs.unlinkSync(newFileName);
				}

				// create all necessary directories, if needed
				grunt.file.mkdir(path.dirname(newFileName));

				// create compressed HTML file
				fs.writeFileSync(newFileName, permutation);

			});

			return files;

		}

		function inlineScriptTags(html, partialPath) {

			// don't inline script tags if disabled
			if(options.tags.script === false) {
				return html;
			}

			var tags = [];
			html = html.replace(/<script[^\>]+src\=[\"\'](?![^\"\']*\/\/)([^\"\']+)[\"\'][^\>]*\><\/script>/g, function(full, fileName) {

				// magic replacements for partials
				if(partialPath) {
					fileName = doPartialMagicToFileName(fileName, partialPath);
				}

				// if we want to omit this file, we can just return the original script tag
				if (options.filesIgnore && options.filesIgnore.includes(fileName)) {
					return full;
				}

				fileName = path.join(options.relativeTo, fileName);
				if(typeof options.tags.script === 'function') {
					fileName = options.tags.script(fileName);
				}

				tags.push(fileName);
				var file = fs.readFileSync(fileName, 'utf8');
				return '<script>' + file + '</script>';
			});

			if(tags.length)
				grunt.log.writeln('  - inlined the following script tags: ', grunt.log.wordlist(tags));

			return html;

		}

		function getExtension(fileName) {
			var ext = path.extname(fileName || '').split('.');
			return ext[ext.length - 1];
		}

		function inlineImageTags(html, partialPath) {

			if (options.tags.img === false) {
				return html;
			}

			var images = [];
			html = html.replace(/(<img[^\>]+src\=[\"\'])(?![^\"\']*\/\/)([^\"\']+)([\"\'][^\>]*\>)/g, function(full, start, fileName, end) {

				// skip over base64
				if (fileName.indexOf('base64') !== -1) {
					return start + fileName + end;
				}

				// magic replacements for partials
				if(partialPath) {
					fileName = doPartialMagicToFileName(fileName, partialPath);
				}

				// if we want to omit this file, we can just return the original image tag
				if (options.filesIgnore && options.filesIgnore.includes(fileName)) {
					return full;
				}

				// optional preEncodeCallback callback
				var rv = (typeof options.tags.img === 'function') ? options.tags.img( path.join(options.relativeTo, fileName) ) : true;
				if (!rv) {
					// failure
					grunt.fail.warn("Failed to encode image " + fileName + ": callback declined");
				} else if (typeof rv === 'string') {
					// replace img by callback-provided string
					// grunt.log.writeln(("replacing " + fileName + " by callback result " + rv).red);
					return start + rv + end;
				} else {
					// use default endcoding
					var imageData = fs.readFileSync(path.join(options.relativeTo, fileName));
					var extension = getExtension(fileName) || 'png';
					var base64 = imageData.toString('base64');

					images.push(fileName);
					return start + 'data:image/' + (extension == 'jpg' ? 'jpeg' : extension) + ';charset=utf-8;base64,' + base64 + end;
				}
			});

			// inline TexturePacker spritemaps in an optimized, slimmed down format
			html = html.replace(/(\<img[^>]+spritemap\=)([\"\'])([^\"\']+)([\"\'])([^>]+\>)/g, function(full, start, quoteStart, map, quoteEnd, end) {

				// magic replacements for partials
				if(partialPath) {
					map = doPartialMagicToFileName(map, partialPath);
				}

				var jsMap = fs.readFileSync(path.join(options.relativeTo, map));
				jsMap = JSON.parse(jsMap).frames;
				for(var frame in jsMap) {
					jsMap[frame] = jsMap[frame].frame;
				}

				return start + "'" + JSON.stringify(jsMap) + "'" + end;
			});

			if(images.length)
				grunt.log.writeln('  - inlined the following images: ', grunt.log.wordlist(images));

			return html;

		}

		grunt.log.subhead('Processing HTML files..');

		this.files.forEach(function(file) {

			grunt.log.writeln('- processing ', file.src, '...');

			// get the contents of the source template(s)
			var contents = file.src.filter(function(filepath) {
					// Remove nonexistent files (it's up to you to filter or warn here).
					if (!grunt.file.exists(filepath)) {
						grunt.log.warn('\tSource file "' + filepath + '" not found.');
						return false;
					} else {
						return true;
					}
				}).map(function(filepath) {
					// Read and return the file's source.
					return grunt.file.read(filepath);
				}).join('\n');

			var dirname = path.relative(options.relativeTo, path.dirname(file.src[0]));

			// inline all JavaScript
			contents = inlineScriptTags(contents, dirname);

			// inline all images
			contents = inlineImageTags(contents, dirname);

			// inline all CSS and create permutations of the file in the build/ folder
			var permutedBuilds = createStylePermutedBuilds(file.dest, contents, dirname);
			inlineLinkTags(file.dest, contents, dirname);

			if(permutedBuilds.length) {
				grunt.log.writeln('  - created additional style-permutated builds: '.green, grunt.log.wordlist(permutedBuilds, { color: 'green' }));
			}

		});

		done();

	});

};

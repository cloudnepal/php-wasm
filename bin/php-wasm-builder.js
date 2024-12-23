#!/usr/bin/env node
const child_process = require('node:child_process');
const path = require('path');
const fs  = require("fs");
var tty = require('tty');

const args = process.argv.slice(2);
const cwd  = process.cwd();
const rcFile = cwd + '/.php-wasm-rc';

const commands = {};

{ // build
	const build = (flags, ...buildArgs) => {

		let envName = 'web'
		let buildType = 'js'
		let binaryMode = 'cli'

		if(buildArgs.includes('node'))
		{
			envName = 'node';
		}

		if(buildArgs.includes('worker'))
		{
			envName = 'worker';
		}

		if(buildArgs.includes('mjs'))
		{
			buildType = 'mjs';
		}

		if(buildArgs.includes('cgi'))
		{
			binaryMode = 'cgi';
		}

		console.log({envName, binaryMode, buildType});
		// const envNameCap = String(envName[0]).toUpperCase() + envName.substr(1);

		const buildTypeLower = String(buildType).toLowerCase();

		// return;

		const options = [
			`${envName}${binaryMode === 'cgi' ? '-cgi-' : '-'}${buildTypeLower}`,
			`PHP_BUILDER_DIR=${cwd}`,
			`BUILD_TYPE=${buildTypeLower}`,
			`IS_TTY=${tty.isatty(process.stdout.fd) ? 1 : 0}`
		];

		console.log(options);

		options.push(`ENV_DIR=${cwd}/`);

		if(fs.existsSync(cwd + '/.php-wasm-rc'))
		{
			options.push(`ENV_FILE=${rcFile}`);
		}

		child_process.spawn(`make`, options, {
			stdio: [ 'inherit', 'inherit', 'inherit' ],
			cwd: __dirname + '/..',
		});
	};

	build.info = `Build php-wasm, optionally using a .php-wasm-rc file in the current directory.`;
	build.help = `Usage: php-wasm-builder build [ENV_NAME] [MODULE_TYPE] [BINARY_TYPE]

  ENV_NAME: [web, node]
    web:  build the web version (default)
    node: build the nodejs version

  MODULE_TYPE: [js, mjs]
    mjs:  build an es6 module (default)
    js:   build a common js module

  BINARY_TYPE: [cli, cgi]
    cli:  standard build (default)
    cgi:  cgi build
`;
	commands.build = build;
}

{ //run
	// const run = (flags, file) => {
	// 	const php = new PhpNode;

	// 	php.addEventListener('output', (event) => event.detail.forEach(l => process.stdout.write(l)));
	// 	php.addEventListener('error',  (event) => event.detail.forEach(l => process.stderr.write(l)));
	// 	php.addEventListener('ready', () => php.run(fs.readFileSync(file)));
	// };

	// run.info = 'Run a script in php-wasm.';
	// run.help = `Usage: php-wasm-builder run FILE

	// FILE - File containing the script to run.`

	// commands.run = run;
}

{ // image
	const image = (flags,) => {
		const options = ['image'];
		const subprocess = child_process.spawn(`make`, options, {
			stdio: [ 'inherit', 'inherit', 'inherit' ],
			cwd: __dirname + '/..',
		});
	};

	image.info = 'Create the build environment docker image';
	image.help = `Usage: php-wasm-builder image.`

	commands.image = image;
}

{ // copy-assets
	const copy_assets = () => {
		const ls = child_process.spawnSync('npm', ['ls', '-p'], { encoding : 'utf8' });

		const allFiles = ls.stdout.split('\n').map(x=>x||'.').map(dir => {
			const json = fs.readFileSync(dir + '/package.json', {encoding: 'utf8'});
			const package = JSON.parse(json);

			if(!package.files)
			{
				return [];
			}

			const files = package.files.filter(name => name.match(/\.(so|dat)$/)).map(file => path.join(dir, file));

			if(!files)
			{
				return [];
			}

			return files;

		}).flat();

		const options = ['-f', 'info.mak'];

		options.push(`ENV_DIR=${cwd}/`);

		if(fs.existsSync(cwd + '/.php-wasm-rc'))
		{
			options.push(`ENV_FILE=${rcFile}`);
		}

		const getAssetPath = child_process.spawnSync(`make`, ['get-asset-path'].concat(options), {
			cwd: __dirname + '/..', encoding : 'utf8'
		});

		const getPhpVersion = child_process.spawnSync(`make`, ['get-php-version'].concat(options), {
			cwd: __dirname + '/..', encoding : 'utf8'
		});

		const assetPath  = getAssetPath.stdout.trim();
		const phpVersion = getPhpVersion.stdout.trim();

		allFiles.forEach(file => {
			const name = path.basename(file);

			if(name.substr(0, 3) === 'php' && name.substr(3, 3) !== phpVersion)
			{
				return;
			}

			const destination = path.join(assetPath, name);

			console.error(`${file}\n => ${destination}`);

			fs.copyFileSync(file, destination);
		});
	};

	copy_assets.info = `Copy shared libs & file packages from node_modules to asset directory.`;
	copy_assets.help = `Usage: php-wasm-builder copy-assets`;

	commands['copy-assets'] = copy_assets;
}

{ // build-assets
	const build_assets = () => {
		const options = [
			`PHP_BUILDER_DIR=${cwd}`,
			`IS_TTY=${tty.isatty(process.stdout.fd) ? 1 : 0}`,
		];

		options.push(`ENV_DIR=${cwd}/`);

		if(fs.existsSync(cwd + '/.php-wasm-rc'))
		{
			options.push(`ENV_FILE=${rcFile}`);
		}

		options.push('assets');

		const subprocess = child_process.spawn(`make`, options, {
			stdio: [ 'inherit', 'inherit', 'inherit' ],
			cwd: __dirname + '/..',
		});
	};

	build_assets.info = `Build shared libs & file packages to asset directory.`;
	build_assets.help = `Usage: php-wasm-builder assets`;

	commands['build-assets'] = build_assets;
}

{ // clean
	const clean = () => {
		const subprocess = child_process.spawn(`make`, ['deep-clean'], {
			stdio: [ 'inherit', 'inherit', 'inherit' ],
			cwd: __dirname + '/..',
		});
	};

	clean.info = `Clear cached build resources.`;
	clean.help = `Usage: php-wasm-builder clean`;

	commands.clean = clean;
}

{ // deep-clean
	const deep_clean = () => {

	};

	deep_clean.info = 'Clear out all downloaded dependencies and start from scratch.';
	deep_clean.help = `Usage: php-wasm-builder deep-clean`

	commands['deep-clean'] = deep_clean;
}

{ // help
	const help = (flags, command = null) => {
		if(command)
		{
			if(!commands[command])
			{
				console.error(`Error: Cannot print help for "${command}". No such command exists.`);
				return;
			}

			console.error(commands[command].help);
			return;
		}

		console.error('Usage: php-wasm-builder [COMMAND] [ARG, ...]');
		console.error('');
		console.error('Available commands');

		for(const [commandName, command] of Object.entries(commands))
		{
			console.error(`  ${commandName}`);
			console.error(`  ${command.info}`);
			console.error('');
		}
	};

	help.info = 'Display helptext for a given command.';
	help.help = `Usage: php-wasm-builder help COMMAND

	COMMAND - Command to print helptext for.`

	commands.help = help;
}

const command = args.shift() || 'help';

const argsToFlags = args => {
	const filterdArgs = [];
	const flags = {};

	args.forEach((arg => {

		if(arg[0] !== '-')
		{
			filterdArgs.push(arg);
			return;
		}

		let offset = 1;

		if(arg[1] === '-')
		{
			offset = 2;
		}

		const index = arg.indexOf('=');

		if(index < 0)
		{
			flags[arg] = true;
			return;
		}

		flags[arg.substr(offset, index - offset)] = arg.substr(1 + index);

		return
	}))

	return [flags, ...filterdArgs];
};

if(!commands[command])
{
	console.error(`Error: No such command: ${command}`);
}
else
{
	commands[command](...argsToFlags(args));
}

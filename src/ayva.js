import util from './util.js';

class Ayva {
  #devices = [];

  #axes = {};

  #frequency = 50; // Hz

  get #step () {
    return Math.floor(1 / this.#frequency);
  }

  /**
   * Create a new instance of Ayva with the specified configuration.
   *
   * @param {Object} [config]
   * @param {String} [config.name] - the name of this configuration
   * @param {String} [config.defaultAxis] - the default axis to command when no axis is specified
   * @param {Object[]} [config.axes] - an array of axis configurations (see {@link Ayva#configureAxis})
   * @class Ayva
   */
  constructor (config) {
    if (config) {
      this.name = config.name;
      this.defaultAxis = config.defaultAxis;
      this.#frequency = (config.frequency || this.#frequency);

      if (config.axes) {
        config.axes.forEach((axis) => {
          this.configureAxis(axis);
        });
      }
    }
  }

  /**
   * Moves all linear and rotation axes to their neutral positions (0.5) or to
   * the value specified at the default speed of 0.5 units/second.
   *
   * @param {Number}
   * @return {Promise} A promise that resolves when the movements are finished.
   */
  home (value = 0.5) {
    if (typeof value !== 'number') {
      throw new Error(`Invalid value: ${value}`);
    }

    const to = util.clamp(value, 0, 1); // TODO: Move this down into the move method.
    const speed = 0.5;

    const movements = this.#getAxesArray()
      .filter((axis) => axis.type === 'linear' || axis.type === 'rotation')
      .map((axis) => ({ to, speed, axis: axis.name }));

    if (movements.length) {
      return this.move(...movements);
    }

    return Promise.resolve();
  }

  /**
   * Performs movements along one or more axes. This is a powerful method that can synchronize
   * axis movement while allowing for fine control over position, speed, and move duration.
   * For full details on how to use this method, see the {@tutorial motion-api} tutorial.
   *
   * @example
   * ayva.move({
   *   axis: 'stroke',
   *   to: 0,
   *   speed: 1,
   * });
   *
   * @param  {Object} movements
   * @return {Promise} a promise that resolves when all movements have finished
   */
  async move (...movements) {
    const suppliers = this.#createValueSuppliers(movements);

    // TODO: Implement
  }

  /**
   * Configures a new axis. If an axis with the same name has already been configured, it will be overridden.
   *
   * @example
   * const ayva = new Ayva();
   *
   * ayva.configureAxis({
   *   name: 'L0',
   *   type: 'linear',
   *   alias: 'stroke',
   *   max: 0.9,
   *   min: 0.3,
   * });
   *
   * @param {Object} axisConfig - axis configuration object
   * @param {String} axisConfig.name - the machine name of this axis (such as L0, R0, etc...)
   * @param {String} axisConfig.type - linear, rotation, auxiliary, or boolean
   * @param {String|String[]} [axisConfig.alias] - an alias used to refer to this axis
   * @param {Object} [axisConfig.max = 1] - specifies maximum value for this axis (not applicable for boolean axes)
   * @param {Number} [axisConfig.min = 0] - specifies minimum value for this axis (not applicable for boolean axes)
   */
  configureAxis (axisConfig) {
    const resultConfig = this.#validateAxisConfig(axisConfig);

    const oldConfig = this.#axes[axisConfig.name];

    if (oldConfig) {
      delete this.#axes[oldConfig.alias];
    }

    this.#axes[axisConfig.name] = resultConfig;

    if (axisConfig.alias) {
      if (this.#axes[axisConfig.alias]) {
        throw new Error(`Alias already refers to another axis: ${axisConfig.alias}`);
      }

      this.#axes[axisConfig.alias] = resultConfig;
    }
  }

  /**
   * Fetch an immutable object containing the properties for an axis.
   *
   * @param {String} name - the name or alias of the axis to get.
   * @return {Object} axisConfig - an immutable object of axis properties.
   */
  getAxis (name) {
    const fetchedAxis = this.#axes[name];

    if (fetchedAxis) {
      const axis = {};

      Object.keys(fetchedAxis).forEach((key) => {
        util.createConstant(axis, key, fetchedAxis[key]);
      });

      return axis;
    }

    return undefined;
  }

  /**
   * Return Ayva's device update frequency in Hz.
   */
  getFrequency () {
    return this.#frequency;
  }

  /**
   * Registers new output devices. Ayva outputs commands to all connected devices.
   *
   * @param {...Object} device - object with a write method.
   */
  addOutputDevices (...devices) {
    for (const device of devices) {
      if (!(device && device.write && device.write instanceof Function)) {
        throw new Error(`Invalid device: ${device}`);
      }
    }

    this.#devices.push(...devices);
  }

  /**
   * Registers new output devices. Ayva outputs commands to all connected devices.
   * Alias for #addOutputDevices()
   *
   * @param {...Object} device - object with a write method.
   */
  addOutputDevice (...devices) {
    this.addOutputDevices(...devices);
  }

  /**
   * Writes the specified command out to all connected devices.
   *
   * Caution: This method is primarily intended for internal usage. Any movements performed
   * by the command will not be tracked by Ayva's internal position tracking.
   * @private
   */
  write (command) {
    if (!this.#devices || !this.#devices.length) {
      throw new Error('No output devices have been added.');
    }

    if (!(typeof command === 'string' || command instanceof String)) {
      throw new Error(`Invalid command: ${command}`);
    }

    if (!(command.trim() && command.trim().length)) {
      throw new Error('Cannot send a blank command.');
    }

    for (const device of this.#devices) {
      device.write(command);
    }
  }

  #createValueSuppliers (movements) {
    this.#validateMovements(movements);
    let maxDuration = 0;

    const computedMovements = movements.map((movement) => {
      // First pass is to fill in or compute all parameters that we can initially.
      const axis = movement.axis || this.defaultAxis;

      const result = {
        axis,
        from: this.#axes[axis].value,
        value: this.#axes[axis].value,
        index: 0,
        time: 0,
        percentage: 0,
      };

      if (util.has(movement, 'duration') && typeof movement.to !== 'function') {
        // If a duration with a constant target has been passed, we can compute the speed.
        result.speed = Math.abs(movement.to - result.from) / movement.duration;
      } else if (util.has(movement, 'speed')) {
        // If a speed has been passed we must be working with constant value (variable value with constant speed is invalid)
        // So we can compute the duration (duration could not have also been passed because of validation)
        result.duration = Math.abs(movement.to - result.from) / movement.speed;
      }

      if (util.has(movement, 'velocity')) {
        // If a velocity function has been passed we must be working with constant value (variable value with velocity function is invalid)
        const difference = movement.to - result.from;

        if (difference > 0) {
          result.direction = 1;
        } else if (difference < 0) {
          result.direction = -1;
        } else {
          result.direction = 0;
        }
      }

      if (util.has(movement, 'sync')) {
        result.sync = movement.sync;
      }

      result.to = movement.to;

      if (util.has(result, 'duration')) {
        maxDuration = result.duration > maxDuration ? result.duration : maxDuration;
      }

      return result;
    });

    const movementsByAxis = computedMovements.reduce((map, p) => (map[p.axis] = p, map), {});

    // Fill in the durations and step count for any remaining axes (such as sync axes)
    computedMovements.forEach((movement) => {
      if (util.has(movement, 'sync')) {
        let syncMovement = movement;

        while (has(syncMovement, 'sync')) {
          syncMovement = movementsByAxis[syncMovement.sync];
        }

        movement.duration = syncMovement.duration || maxDuration;

        if (typeof movement.to !== 'function') {
          movement.speed = (movement.to - movement.from) / movement.duration;
        }
      } else if (!util.has(movement, 'duration') && this.#axes[movement.axis].type !== 'boolean') {
        movement.duration = maxDuration;
      }

      if (util.has(movement, 'duration')) {
        movement.totalSteps = Math.round(movement.duration * this.#frequency);
      }
    });

    // Create final value suppliers.
    return computedMovements.map((movement) => {
      const supplier = {};

      if (typeof movement.to !== 'function') {
        // Create a value supplier from parameters.
        if (this.#axes[movement.axis].type === 'boolean') {
          supplier.valueSupplier = () => movement.to;
        } else if (util.has(movement, 'velocity')) {
          const deltaFunction = movement.velocity;
          supplier.valueSupplier = (params) => params.value + deltaFunction(params);
        } else {
          const delta = (movement.to - movement.from) / movement.totalSteps;
          supplier.valueSupplier = (params) => params.value + delta;
        }
      } else {
        // User provided value supplier.
        supplier.valueSupplier = movement.to;
        delete movement.to;
      }

      delete movement.sync;
      supplier.parameters = movement;
      return supplier;
    });
  }

  /**
   * All the validation on movement descriptors :O
   *
   * TODO: Clean this up and maybe move some of this out into a generic, parameterizable validator.
   *
   * @param {*} movements
   */
  #validateMovements (movements) {
    const { has, fail } = util;
    const movementMap = {};
    let atLeastOneDuration = false;
    let atLeastOneNonBoolean = false;

    if (!movements || !movements.length) {
      fail('Must supply at least one movement.');
    }

    movements.forEach((movement) => {
      if (!movement || typeof movement !== 'object') {
        fail(`Invalid movement: ${movement}`);
      }

      const invalidValue = (name) => fail(`Invalid value for parameter '${name}': ${movement[name]}`);
      const hasSpeed = has(movement, 'speed');
      const hasDuration = has(movement, 'duration');
      const hasVelocity = has(movement, 'velocity');
      const axis = movement.axis || this.defaultAxis;

      if (!axis) {
        fail('No default axis configured. Must specify an axis for each movement.');
      }

      if (has(movement, 'axis')) {
        if (typeof movement.axis !== 'string' || !movement.axis.trim() || !this.#axes[movement.axis]) {
          invalidValue('axis');
        }
      }

      if (typeof movement.to !== 'function') {
        let invalidTo = false;

        if (this.#axes[axis].type === 'boolean') {
          invalidTo = typeof movement.to !== 'boolean';
        } else {
          invalidTo = typeof movement.to !== 'number' || (movement.to < 0 || movement.to > 1);
        }

        if (invalidTo) {
          invalidValue('to');
        }
      }

      if (hasSpeed && hasDuration) {
        fail('Cannot supply both speed and duration.');
      }

      if (hasSpeed || hasDuration) {
        atLeastOneDuration = true;

        if (hasSpeed && (typeof movement.speed !== 'number' || movement.speed <= 0)) {
          invalidValue('speed');
        } else if (hasDuration && (typeof movement.duration !== 'number' || movement.duration <= 0)) {
          invalidValue('duration');
        }
      }

      if (typeof movement.to === 'function') {
        if (hasSpeed && !hasDuration) {
          fail('Must provide a duration when \'to\' is a function.');
        }
      }

      if (hasVelocity && typeof movement.velocity !== 'function') {
        fail('\'velocity\' must be a function.');
      } else if (hasVelocity && typeof movement.to === 'function') {
        fail('Cannot provide both a value and velocity function.');
      }

      if (has(movement, 'sync')) {
        if (typeof movement.sync !== 'string' || !movement.sync.trim()) {
          invalidValue('sync');
        }

        if (has(movement, 'speed') || has(movement, 'duration')) {
          fail(`Cannot specify a speed or duration when sync property is present: ${movement.axis}`);
        }
      }

      if (this.#axes[axis].type !== 'boolean') {
        atLeastOneNonBoolean = true;
      } else {
        if (has(movement, 'speed') || has(movement, 'velocity')) {
          fail(`Cannot specify speed or velocity for boolean axes: ${axis}`);
        }

        if (has(movement, 'duration') && typeof movement.to !== 'function') {
          fail('Cannot specify a duration for a boolean axis movement with constant value.');
        }
      }

      if (movementMap[axis]) {
        fail(`Duplicate axis movement: ${axis}`);
      }

      movementMap[axis] = movement;
    });

    movements.forEach((movement) => {
      let syncMovement = movement;
      const originalMovementAxis = movement.axis;

      while (has(syncMovement, 'sync')) {
        if (!movementMap[syncMovement.sync]) {
          fail(`Cannot sync with axis not specified in movement: ${syncMovement.axis} -> ${syncMovement.sync}`);
        }

        syncMovement = movementMap[syncMovement.sync];

        if (syncMovement.sync === originalMovementAxis) {
          fail('Sync axes cannot form a cycle.');
        }
      }
    });

    if (!atLeastOneDuration && atLeastOneNonBoolean) {
      fail('At least one movement must have a speed or duration.');
    }
  }

  /**
   * Ensure all required fields are present in the configuration and that all are of valid types.
   *
   * TODO: Move some of this out into a generic validator that takes a validation spec.
   * @param {Object} axisConfig
   */
  #validateAxisConfig (axisConfig) {
    if (!axisConfig || typeof axisConfig !== 'object') {
      throw new Error(`Invalid configuration object: ${axisConfig}`);
    }

    const required = ['name', 'type'];

    const types = {
      name: 'string',
      type: 'string',
      alias: 'string',
      max: 'number',
      min: 'number',
    };

    const missing = required.filter(
      (property) => axisConfig[property] === undefined || axisConfig[property] === null
    ).sort();

    if (missing.length) {
      throw new Error(`Configuration is missing properties: ${missing.join(', ')}`);
    }

    const invalid = [];

    Object.keys(types).forEach((property) => {
      const value = axisConfig[property];

      // Since we've already caught missing required fields by this point,
      // we only need to check types of optional fields if they are actually present.
      if (value !== undefined && value !== null) {
        // eslint-disable-next-line valid-typeof
        if (typeof value !== types[property]) {
          invalid.push(property);
        } else if (property === 'min' || property === 'max') {
          if (value < 0 || value > 1) {
            invalid.push(property);
          }
        }
      }
    });

    if (invalid.length) {
      const message = invalid.sort().map((property) => `${property} = ${axisConfig[property]}`).join(', ');
      throw new Error(`Invalid configuration parameter(s): ${message}`);
    }

    if (['linear', 'rotation', 'auxiliary', 'boolean'].indexOf(axisConfig.type) === -1) {
      throw new Error(`Invalid type. Must be linear, rotation, auxiliary, or boolean: ${axisConfig.type}`);
    }

    const resultConfig = {
      ...axisConfig,
      max: axisConfig.max || 1,
      min: axisConfig.min || 0,
      value: axisConfig.type === 'boolean' ? false : 0.5, // Default value. 0.5 is home position for linear, rotation, and auxiliary.
    };

    if (resultConfig.max === resultConfig.min || resultConfig.min > resultConfig.max) {
      throw new Error(`Invalid configuration parameter(s): max = ${resultConfig.max}, min = ${resultConfig.min}`);
    }

    return resultConfig;
  }

  #getAxesArray () {
    const uniqueAxes = {};

    Object.values(this.#axes).forEach((axis) => {
      uniqueAxes[axis.name] = axis;
    });

    function sortByName (a, b) {
      if (a.name > b.name) {
        return 1;
      }

      return a.name < b.name ? -1 : 0;
    }

    return Object.values(uniqueAxes).sort(sortByName);
  }
}

// Separate default export from the class declaration because of jsdoc shenanigans...
export default Ayva;

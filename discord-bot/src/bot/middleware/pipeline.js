/**
 * Composes an array of middleware functions into a single executable function.
 * Follows the Koa-compose style: (interaction, command, next) => Promise
 *
 * @param {Array<Function>} middlewares
 * @returns {Function}
 */
function compose(middlewares) {
  if (!Array.isArray(middlewares)) {
    throw new TypeError('Middleware stack must be an array!');
  }
  for (const fn of middlewares) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function!');
    }
  }

  return function (interaction, command, next) {
    let index = -1;
    return dispatch(0);

    function dispatch(i) {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;
      let fn = middlewares[i];
      if (i === middlewares.length) {
        fn = next;
      }
      if (!fn) {
        return Promise.resolve();
      }
      try {
        return Promise.resolve(fn(interaction, command, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  };
}

module.exports = { compose };

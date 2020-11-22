import { TaskQueue } from './TaskQueue';

/**
 * Create deferred object.
 *
 * @returns {{promise, resolve, reject}}
 */
export function createDeferred() {
    const deferred = {};

    deferred.promise = new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });

    return deferred;
}

/**
 * Returns an instance of {@link TaskQueue}.
 *
 * @returns {Object}
 */
export function createTaskQueue() {
    return new TaskQueue();
}

/**
 * Appends a js file to the page using the script tag
 *
 * @returns void
 */
export const appendScript = (scriptToAppend) => {
    const script = document.createElement("script");
    script.src = scriptToAppend;
    script.async = true;
    document.body.appendChild(script);
}

/**
 * Removes a js file from script tag
 *
 * @returns void
 */
export const removeScript = (scriptToremove) => {
    let allsuspects=document.getElementsByTagName("script");
    for (let i=allsuspects.length; i>=0; i--) {
      if (allsuspects[i] && allsuspects[i].getAttribute("src") !== null
          && allsuspects[i].getAttribute("src").indexOf(`${scriptToremove}`) !== -1 ) {
           allsuspects[i].parentNode.removeChild(allsuspects[i])
        }
    }
}

/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as Q from 'q';
import * as Qajax from 'qajax';
import { $, Expression, Executor, Dataset, ChainExpression, SplitAction, Environment } from 'swiv-plywood';

Qajax.defaults.timeout = 0; // We'll manage the timeout per request.

function getSplitsDescription(ex: Expression): string {
  var splits: string[] = [];
  ex.forEach((ex) => {
    if (ex instanceof ChainExpression) {
      ex.actions.forEach((action) => {
        if (action instanceof SplitAction) {
          splits.push(action.firstSplitExpression().toString());
        }
      });
    }
  });
  return splits.join(';');
}

var reloadRequested = false;
function reload() {
  if (reloadRequested) return;
  reloadRequested = true;
  window.location.reload(true);
}

function parseOrNull(json: any): any {
  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

export interface AjaxOptions {
  method: 'GET' | 'POST';
  url: string;
  data?: any;
}

export class Ajax {
  static version: string;

  static settingsVersionGetter: () => number;
  static onUpdate: () => void;

  private static ks: string;
  private static jwt: string;
  private static forceReload: boolean = false;
  private static authenticateRequest: Q.Promise<any> = null;

  private static authenticate(): Q.Promise<any> {
    return Qajax({
      method: 'POST',
      url: 'kaltura/authenticate',
      data: {
        ks : Ajax.ks
      }
    })
      .timeout(60000)
      .then(Qajax.filterSuccess)
      .then(Qajax.toJSON)
      .then((res) => {
        Ajax.jwt = res.token;
      })
      .catch((xhr: XMLHttpRequest | Error): Dataset => {
        Ajax.forceReload = true;
        if (!xhr) return null; // TS needs this
        if (xhr instanceof Error) {
          throw new Error('client timeout');
        } else {
          var jsonError = parseOrNull(xhr.responseText);
          if (jsonError) {
            console.error(jsonError.message || jsonError.error);
            throw new Error('unauthorized');
          } else {
            throw new Error(xhr.responseText || 'connection fail');
          }
        }
      }).finally(() => {
        Ajax.authenticateRequest = null;
      });
  }

  static query(options: AjaxOptions): Q.Promise<any> {

    if (Ajax.forceReload) {
      return Q.reject(new Error('a reload is required'));
    }

    // if a jwt was passed as parameter - use it
    let authenticate: Q.Promise<any> = null;
    if (!Ajax.jwt && Ajax.getParameterByName('jwt')) {
      Ajax.jwt = Ajax.getParameterByName('jwt');
    }

    if (!Ajax.jwt) {
      // ensure ks was provided
      if (!Ajax.ks) {
        Ajax.ks = Ajax.getParameterByName('ks');

        if (!Ajax.ks) {
          return Q.reject(new Error('missing ks'));
        }
      }

      // execute authentication
      if (Ajax.authenticateRequest) {
        authenticate = Ajax.authenticateRequest;
      } else {
        Ajax.authenticateRequest = authenticate = Ajax.authenticate();
      }

    } else {
      authenticate = Q.resolve(null);
    }

    return authenticate.then(
      response => {
        var data = options.data;

        if (data) {
          if (Ajax.version) data.version = Ajax.version;
          if (Ajax.settingsVersionGetter) data.settingsVersion = Ajax.settingsVersionGetter();
        }

        return Qajax({
          method: options.method,
          url: options.url,
          headers : { "x-access-token" : Ajax.jwt },
          data
        })
          .timeout(60000)
          .then(Qajax.filterSuccess)
          .then(Qajax.toJSON)
          .then((res) => {
            if (res && res.action === 'update' && Ajax.onUpdate) Ajax.onUpdate();
            return res;
          })
          .catch((xhr: XMLHttpRequest | Error): Q.Promise<any> => {
            if (!xhr) return null; // TS needs this
            if (xhr instanceof Error) {
              throw new Error('client timeout');
            } else {
              var jsonError = parseOrNull(xhr.responseText);
              if (jsonError) {
                if (jsonError.action === 're-authenticate') {
                  // remove jwt and re-query (will force re-authentication)
                  Ajax.jwt = null;
                  return Ajax.query(options);
                }
                if (jsonError.action === 'reload') {
                  reload();
                } else if (jsonError.action === 'update' && Ajax.onUpdate) {
                  Ajax.onUpdate();
                }
                throw new Error(jsonError.message || jsonError.error);
              } else {
                throw new Error(xhr.responseText || 'connection fail');
              }
            }
          });
      }
    );
  }

  static getParameterByName(name: string, url?: string) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  static queryUrlExecutorFactory(name: string, url: string): Executor {
    return (ex: Expression, env: Environment = {}) => {
      return Ajax.query({
        method: "POST",
        url: url + '?by=' + getSplitsDescription(ex),
        data: {
          dataCube: name,
          expression: ex.toJS(),
          timezone: env ? env.timezone : null
        }
      }).then((res) => Dataset.fromJS(res.result));
    };
  }
}

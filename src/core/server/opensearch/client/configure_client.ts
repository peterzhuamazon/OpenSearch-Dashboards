/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Buffer } from 'buffer';
import { stringify } from 'querystring';
import { Client } from '@opensearch-project/opensearch';
import { RequestBody } from '@opensearch-project/opensearch/lib/Transport';

import { Logger } from '../../logging';
import { parseClientOptions, OpenSearchClientConfig } from './client_config';

export const configureClient = (
  config: OpenSearchClientConfig,
  {
    logger,
    scoped = false,
    withLongNumeralsSupport = false,
  }: { logger: Logger; scoped?: boolean; withLongNumeralsSupport?: boolean }
): Client => {
  const clientOptions = parseClientOptions(config, scoped);
  if (withLongNumeralsSupport) clientOptions.enableLongNumeralSupport = true;

  const client = new Client(clientOptions);
  addLogging(client, logger, config.logQueries);

  return client;
};

const addLogging = (client: Client, logger: Logger, logQueries: boolean) => {
  client.on('response', (error, event) => {
    if (error) {
      const errorMessage =
        // error details for response errors provided by opensearch, defaults to error name/message
        `[${event.body?.error?.type ?? error.name}]: ${event.body?.error?.reason ?? error.message}`;

      logger.error(errorMessage);
    }
    if (event && logQueries) {
      const params = event.meta.request.params;

      // definition is wrong, `params.querystring` can be either a string or an object
      const querystring = convertQueryString(params.querystring);
      const url = `${params.path}${querystring ? `?${querystring}` : ''}`;
      const body = params.body ? `\n${ensureString(params.body)}` : '';
      logger.debug(`${event.statusCode}\n${params.method} ${url}${body}`, {
        tags: ['query'],
      });
    }
  });
};

const convertQueryString = (qs: string | Record<string, any> | undefined): string => {
  if (qs === undefined || typeof qs === 'string') {
    return qs ?? '';
  }
  return stringify(qs);
};

function ensureString(body: RequestBody): string {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return '[buffer]';
  if ('readable' in body && body.readable && typeof body._read === 'function') return '[stream]';
  return JSON.stringify(body);
}

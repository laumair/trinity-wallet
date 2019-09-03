import assign from 'lodash/assign';
import { composeAPI } from '@iota/core';
import 'proxy-polyfill';
import Quorum from './quorum';
import { DEFAULT_NODE, DEFAULT_NODES, DEFAULT_NODE_REQUEST_TIMEOUT, QUORUM_SIZE } from '../../config';

/** Globally defined IOTA instance */
export const iota = composeAPI(
    assign({}, DEFAULT_NODE, {
        provider: DEFAULT_NODE.url,
    }),
);

// Set node request timeout
// iota.api.setApiTimeout(DEFAULT_NODE_REQUEST_TIMEOUT);

/** Globally defined Quorum instance */
export const quorum = new Quorum({
    nodes: DEFAULT_NODES,
    quorumSize: QUORUM_SIZE,
});

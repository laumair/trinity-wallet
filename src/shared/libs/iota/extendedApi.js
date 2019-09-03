import get from 'lodash/get';
import head from 'lodash/head';
import has from 'lodash/has';
import includes from 'lodash/includes';
import map from 'lodash/map';
import orderBy from 'lodash/orderBy';
import { composeAPI } from '@iota/core';
import { asTransactionObject, asTransactionTrytes } from '@iota/transaction-converter';
import { iota, quorum } from './index';
import Errors from '../errors';
import { isWithinMinutes } from '../date';
import {
    DEFAULT_BALANCES_THRESHOLD,
    DEFAULT_DEPTH,
    DEFAULT_MIN_WEIGHT_MAGNITUDE,
    DEFAULT_NODE_REQUEST_TIMEOUT,
    GET_NODE_INFO_REQUEST_TIMEOUT,
    WERE_ADDRESSES_SPENT_FROM_REQUEST_TIMEOUT,
    GET_BALANCES_REQUEST_TIMEOUT,
    ATTACH_TO_TANGLE_REQUEST_TIMEOUT,
    GET_TRANSACTIONS_TO_APPROVE_REQUEST_TIMEOUT,
    IRI_API_VERSION,
    MAX_MILESTONE_FALLBEHIND,
} from '../../config';
import {
    sortTransactionTrytesArray,
    constructBundleFromAttachedTrytes,
    isBundle,
    isBundleTraversable,
} from './transfers';
import { EMPTY_HASH_TRYTES, withRequestTimeoutsHandler } from './utils';

/**
 * Returns timeouts for specific quorum requests
 *
 * @method getApiTimeout
 * @param {string} method
 * @param {array} [payload]

 * @returns {number}
 */
/* eslint-disable no-unused-vars */
const getApiTimeout = (method, payload) => {
    /* eslint-enable no-unused-vars */
    switch (method) {
        case 'wereAddressesSpentFrom':
            return WERE_ADDRESSES_SPENT_FROM_REQUEST_TIMEOUT;
        case 'getBalances':
            return GET_BALANCES_REQUEST_TIMEOUT;
        case 'getNodeInfo':
            return GET_NODE_INFO_REQUEST_TIMEOUT;
        case 'attachToTangle':
            return ATTACH_TO_TANGLE_REQUEST_TIMEOUT;
        case 'getTransactionsToApprove':
            return GET_TRANSACTIONS_TO_APPROVE_REQUEST_TIMEOUT;
        default:
            return DEFAULT_NODE_REQUEST_TIMEOUT;
    }
};

/**
 * Returns a new IOTA instance if provider is passed, otherwise returns the global instance
 *
 * @method getIotaInstance
 * @param {object} [settings]
 *
 * @returns {object} IOTA instance
 */
const getIotaInstance = (settings, requestTimeout = DEFAULT_NODE_REQUEST_TIMEOUT) => {
    if (settings) {
        const { url, token, password } = settings;

        const instance = composeAPI({ provider: url, password, token });
        // instance.api.setApiTimeout(requestTimeout);

        return instance;
    }

    // iota.api.setApiTimeout(requestTimeout);

    return iota;
};

/**
 * Wraps iota.getBalances (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getBalances)
 *
 * @method getBalancesAsync
 * @param {object} [settings]
 * @param {boolean} [withQuorum]
 *
 * @returns {function(array, number): Promise<object>}
 */
const getBalancesAsync = (settings, withQuorum = true) => (addresses, threshold = DEFAULT_BALANCES_THRESHOLD) =>
    withQuorum
        ? quorum.getBalances(addresses, threshold)
        : getIotaInstance(settings, getApiTimeout('getBalances')).getBalances(addresses, threshold);

/**
 * Wraps iota.getNodeInfo (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getNodeInfo)
 *
 * @method getNodeInfoAsync
 * @param {object} [settings]
 *
 * @returns {function(): Promise<object>}
 */
const getNodeInfoAsync = (settings) => () => getIotaInstance(settings, getApiTimeout('getNodeInfo')).getNodeInfo();

/**
 * Wraps iota.getTransactionsObjects (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getTransactionObjects)
 *
 * @method getTransactionsObjectsAsync
 * @param {object} [settings]
 *
 * @returns {function(array): Promise<any>}
 */
const getTransactionsObjectsAsync = (settings) => (hashes) => getIotaInstance(settings).getTransactionsObjects(hashes);

/**
 * Wraps iota.findTransactionObjects (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.findTransactionObjects)
 *
 * @method findTransactionObjectsAsync
 * @param {object} [settings]
 *
 * @returns {function(object): Promise<any>}
 */
const findTransactionObjectsAsync = (settings) => (args) =>
    findTransactionsAsync(settings)(args).then((hashes) => getTransactionsObjectsAsync(settings)(hashes));

/**
 * Wraps iota.findTransactions (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.findTransactions)
 *
 * @method findTransactionsAsync
 * @param {object} [settings]
 *
 * @returns {function(object): Promise<array>}
 */
const findTransactionsAsync = (settings) => (args) => getIotaInstance(settings).findTransactions(args);

/**
 * Wraps iota.getLatestInclusion (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getLatestInclusion)
 *
 * @method getLatestInclusionAsync
 * @param {object} [settings]
 * @param {boolean} [withQuorum]
 *
 * @returns {function(array): Promise<array>}
 */
const getLatestInclusionAsync = (settings, withQuorum = false) => (hashes) =>
    withQuorum
        ? quorum.getLatestInclusion(hashes)
        : getIotaInstance(settings, getApiTimeout('getInclusionStates')).getLatestInclusion(hashes);

/**
 * Extended version of iota.promoteTransaction (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.promoteTransaction) with an option to perform PoW locally
 *
 * @method promoteTransactionAsync
 * @param {object} [settings]
 * @param {object} seedStore
 *
 * @returns {function(string, number, number, object): Promise<string>}
 */
const promoteTransactionAsync = (settings, seedStore) => (
    hash,
    depth = DEFAULT_DEPTH,
    minWeightMagnitude = DEFAULT_MIN_WEIGHT_MAGNITUDE,
    transfer = { address: 'U'.repeat(81), value: 0, message: '', tag: '' },
) => {
    const cached = {
        trytes: [],
    };

    return (
        isPromotable(settings)(hash, { rejectWithReason: true })
            // rejectWithReason only resolves if provided hashes are consistent
            .then(() => prepareTransfersAsync(settings)(transfer.address, [transfer]))
            .then((trytes) => {
                cached.trytes = trytes;

                return getTransactionsToApproveAsync(settings)(
                    {
                        reference: hash,
                        adjustDepth: true,
                    },
                    depth,
                );
            })
            .then(({ trunkTransaction, branchTransaction }) =>
                attachToTangleAsync(settings, seedStore)(
                    trunkTransaction,
                    branchTransaction,
                    cached.trytes,
                    minWeightMagnitude,
                ),
            )
            .then(({ trytes }) => {
                cached.trytes = trytes;

                return storeAndBroadcastAsync(settings)(cached.trytes);
            })
            .then(() => hash)
    );
};

/**
 * Wraps iota.replayBundle (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.replayBundle)
 *
 * @method replayBundleAsync
 * @param {object} [settings]
 * @param {object} seedStore
 *
 * @returns {function(string, function, number, number): Promise<array>}
 */
const replayBundleAsync = (settings, seedStore) => (
    hash,
    depth = DEFAULT_DEPTH,
    minWeightMagnitude = DEFAULT_MIN_WEIGHT_MAGNITUDE,
) => {
    const cached = {
        trytes: [],
        transactionObjects: [],
    };

    return getBundleAsync(settings)(hash)
        .then((bundle) => {
            const convertToTrytes = (tx) => asTransactionTrytes(tx);
            cached.trytes = map(bundle, convertToTrytes);
            cached.transactionObjects = bundle;

            return getTransactionsToApproveAsync(settings)({}, depth);
        })
        .then(({ trunkTransaction, branchTransaction }) =>
            attachToTangleAsync(settings, seedStore)(
                trunkTransaction,
                branchTransaction,
                cached.trytes,
                minWeightMagnitude,
            ),
        )
        .then(({ trytes, transactionObjects }) => {
            cached.trytes = trytes;
            cached.transactionObjects = transactionObjects;

            return storeAndBroadcastAsync(settings)(cached.trytes);
        })
        .then(() => cached.transactionObjects);
};

/**
 * Wraps iota.getBundle (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getBundle)
 *
 * @method getBundleAsync
 * @param {object} [settings]
 *
 * @returns {function(string): Promise<array>}
 */
const getBundleAsync = (settings) => (tailTransactionHash) => getIotaInstance(settings).getBundle(tailTransactionHash);

/**
 * Wraps iota.wereAddressesSpentFrom
 *
 * @method wereAddressesSpentFromAsync
 * @param {object} [settings]
 * @param {boolean} [withQuorum]
 *
 * @returns {function(array): Promise<array>}
 */
const wereAddressesSpentFromAsync = (settings, withQuorum = true) => (addresses) =>
    withQuorum ? quorum.wereAddressesSpentFrom(addresses) : Promise.resolve(addresses.map(() => false));
// : getIotaInstance(settings, getApiTimeout('wereAddressesSpentFrom')).wereAddressesSpentFrom(addresses);

/**
 * Prepares and broadcasts a transfer
 *
 * @method sendTransferAsync
 * @param {object} [settings]
 *
 * @returns {function(object, array, function, *, number, number): Promise<array>}
 */
const sendTransferAsync = (settings) => (
    seedStore,
    transfers,
    options = null,
    depth = DEFAULT_DEPTH,
    minWeightMagnitude = DEFAULT_MIN_WEIGHT_MAGNITUDE,
) => {
    const cached = {
        trytes: [],
        transactionObjects: [],
    };

    return seedStore
        .prepareTransfers(settings)(transfers, options)
        .then((trytes) => {
            cached.trytes = trytes;

            return getTransactionsToApproveAsync(settings)({}, depth);
        })
        .then(({ trunkTransaction, branchTransaction }) =>
            attachToTangleAsync(settings, seedStore)(
                trunkTransaction,
                branchTransaction,
                cached.trytes,
                minWeightMagnitude,
            ),
        )
        .then(({ trytes, transactionObjects }) => {
            cached.trytes = trytes;
            cached.transactionObjects = transactionObjects;

            return storeAndBroadcastAsync(settings)(cached.trytes);
        })
        .then(() => cached.transactionObjects);
};

/**
 * Wraps iota.getTransactionsToApprove (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getTransactionsToApprove)
 *
 * @method getTransactionsToApproveAsync
 * @param {object} [settings]
 *
 * @returns {function(*, number): Promise<object>}
 */
const getTransactionsToApproveAsync = (settings) => (reference = {}, depth = DEFAULT_DEPTH) =>
    getIotaInstance(settings, getApiTimeout('getTransactionsToApprove')).getTransactionsToApprove(depth, reference);

/**
 * Wraps iota.prepareTransfers (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.prepareTransfers)
 *
 * @method prepareTransfersAsync
 * @param {object} [settings]
 *
 * @returns {function(string, array, *): Promise<any>}
 */
export const prepareTransfersAsync = (settings) => (seed, transfers, options = null, signatureFn = null) => {
    let args = [seed, transfers];

    if (options) {
        args = [...args, { ...options, nativeGenerateSignatureFunction: signatureFn }];
    }

    return getIotaInstance(settings).prepareTransfers(...args);
};

/**
 * Wraps iota.storeAndBroadcast (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.storeAndBroadcast)
 *
 * @method storeAndBroadcastAsync
 * @param {object} [settings]
 *
 * @returns {function(array): Promise<any>}
 */
const storeAndBroadcastAsync = (settings) => (trytes) => getIotaInstance(settings).storeAndBroadcast(trytes);

/**
 * Checks if attachToTangle is available on the provided node
 *
 * @method checkAttachToTangleAsync
 * @param {string} node
 *
 * @returns {Promise}
 */
const checkAttachToTangleAsync = (node) => {
    return fetch(node, {
        method: 'POST',
        body: JSON.stringify({ command: 'attachToTangle' }),
        headers: new Headers({
            'Content-Type': 'application/json',
            'X-IOTA-API-Version': IRI_API_VERSION,
        }),
    })
        .then((response) => {
            if (response.ok) {
                return response.json();
            }

            throw response;
        })
        .catch(() => {
            // return a fake normal IRI response when attachToTangle is not available
            return { error: Errors.ATTACH_TO_TANGLE_UNAVAILABLE };
        });
};

/**
 * Checks if remote pow is allowed on the provided node
 *
 * @method allowsRemotePow
 * @param {object} settings
 *
 * @returns {Promise<Boolean>}
 */
const allowsRemotePow = (settings) => {
    return getNodeInfoAsync(settings)().then((info) => {
        // Check if provided node has upgraded to IRI to a version, where it adds "features" prop in node info
        if (has(info, 'features')) {
            return includes(info.features, 'RemotePOW');
        }

        // Fallback to old way of checking remote pow
        return checkAttachToTangleAsync(settings.url).then((response) =>
            includes(response.error, Errors.INVALID_PARAMETERS),
        );
    });
};

/**
 * Wraps iota.attachToTangle (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.attachToTangle)
 *
 * @method attachToTangleAsync
 * @param {object} [settings]
 * @param {object} seedStore
 *
 * @returns {function(string, string, array, number): Promise<object>}
 */
const attachToTangleAsync = (settings, seedStore) => (
    trunkTransaction,
    branchTransaction,
    trytes,
    minWeightMagnitude = DEFAULT_MIN_WEIGHT_MAGNITUDE,
) => {
    const shouldOffloadPow = get(seedStore, 'offloadPow') === true;

    if (shouldOffloadPow) {
        const request = (requestTimeout) =>
            getIotaInstance(settings, requestTimeout)
                .attachToTangle(
                    trunkTransaction,
                    branchTransaction,
                    minWeightMagnitude,
                    // Make sure trytes are sorted properly
                    sortTransactionTrytesArray(trytes),
                )
                .then((attachedTrytes) => {
                    return constructBundleFromAttachedTrytes(attachedTrytes, seedStore).then((transactionObjects) => {
                        if (
                            isBundle(transactionObjects) &&
                            isBundleTraversable(transactionObjects, trunkTransaction, branchTransaction)
                        ) {
                            return {
                                transactionObjects,
                                trytes: attachedTrytes,
                            };
                        }

                        throw new Error(Errors.INVALID_BUNDLE_CONSTRUCTED_WITH_REMOTE_POW);
                    });
                });

        const defaultRequestTimeout = getApiTimeout('attachToTangle');

        return withRequestTimeoutsHandler(defaultRequestTimeout)(request);
    }

    return seedStore
        .performPow(trytes, trunkTransaction, branchTransaction, minWeightMagnitude)
        .then((result) => {
            if (get(result, 'trytes') && get(result, 'transactionObjects')) {
                return Promise.resolve(result);
            }

            // Batched proof-of-work only returns the attached trytes
            return constructBundleFromAttachedTrytes(sortTransactionTrytesArray(result), seedStore).then(
                (transactionObjects) => ({
                    transactionObjects: orderBy(transactionObjects, 'currentIndex', ['desc']),
                    trytes: result,
                }),
            );
        })
        .then(({ transactionObjects, trytes }) => {
            if (
                isBundle(transactionObjects) &&
                isBundleTraversable(transactionObjects, trunkTransaction, branchTransaction)
            ) {
                return {
                    transactionObjects,
                    trytes,
                };
            }

            throw new Error(Errors.INVALID_BUNDLE_CONSTRUCTED_WITH_LOCAL_POW);
        });
};

/**
 * Wraps iota.getTrytes (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.getTrytes)
 *
 * @method getTrytesAsync
 * @param {object} [settings]
 *
 * @returns {function(array): Promise<array>}
 */
const getTrytesAsync = (settings) => (hashes) => getIotaInstance(settings).getTrytes(hashes);

/**
 * Checks if a node is synced and runs a stable IRI release
 *
 * @method isNodeHealthy
 * @param {object} [settings]
 *
 * @returns {Promise}
 */
const isNodeHealthy = (settings) => {
    const cached = {
        latestMilestone: EMPTY_HASH_TRYTES,
    };

    return getNodeInfoAsync(settings)()
        .then(
            ({
                appVersion,
                latestMilestone,
                latestMilestoneIndex,
                latestSolidSubtangleMilestone,
                latestSolidSubtangleMilestoneIndex,
            }) => {
                if (['rc', 'beta', 'alpha'].some((el) => appVersion.toLowerCase().indexOf(el) > -1)) {
                    throw new Error(Errors.UNSUPPORTED_NODE);
                }
                cached.latestMilestone = latestMilestone;
                if (
                    (cached.latestMilestone === latestSolidSubtangleMilestone ||
                        latestMilestoneIndex - MAX_MILESTONE_FALLBEHIND <= latestSolidSubtangleMilestoneIndex) &&
                    cached.latestMilestone !== EMPTY_HASH_TRYTES
                ) {
                    return getTrytesAsync(settings)([cached.latestMilestone]);
                }

                throw new Error(Errors.NODE_NOT_SYNCED);
            },
        )
        .then((trytes) => {
            const { timestamp } = asTransactionObject(head(trytes), cached.latestMilestone);

            return isWithinMinutes(timestamp * 1000, 5 * MAX_MILESTONE_FALLBEHIND);
        });
};

/**
 * Wraps iota.isPromotable (https://github.com/iotaledger/iota.js/tree/next/packages/core#module_core.isPromotable)
 *
 * @method isPromotable
 * @param {object} [settings]
 *
 * @returns {function(string): (Promise<boolean>)}
 */
const isPromotable = (settings) => (tailTransactionHash, options = {}) =>
    getIotaInstance(settings).isPromotable(tailTransactionHash, options);

export {
    getIotaInstance,
    getApiTimeout,
    getBalancesAsync,
    getNodeInfoAsync,
    getTransactionsObjectsAsync,
    findTransactionObjectsAsync,
    findTransactionsAsync,
    getLatestInclusionAsync,
    promoteTransactionAsync,
    replayBundleAsync,
    getBundleAsync,
    wereAddressesSpentFromAsync,
    sendTransferAsync,
    getTransactionsToApproveAsync,
    storeAndBroadcastAsync,
    attachToTangleAsync,
    checkAttachToTangleAsync,
    allowsRemotePow,
    isNodeHealthy,
    isPromotable,
};

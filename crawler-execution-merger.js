const Apify = require('apify');

const pretty = object => JSON.stringify(object, null, 2);

Apify.main(async () => {
  const input = await Apify.getValue('INPUT');
  console.log('My input:');
  console.dir(input);

  if (!input || !input.data) {
    throw new Error('INPUT and data are required');
  }
  const {
    data: storeName,
    _id: executionId,
    actId: crawlerId
  } = input;

  const output = {
    crawledAt: new Date(),
    saveAt: storeName,
    input
  };
  const setValueRequest = Apify.setValue('OUTPUT', output);

  const { keyValueStores, crawlers } = Apify.client;
  const storeRequest = keyValueStores.getOrCreateStore({ storeName });
  const crawlerRequest = crawlers.getLastExecutionResults({ executionId, crawlerId });
  const [{ id: storeId }, crawlerResults] = await Promise.all([storeRequest, crawlerRequest]);
  const items = crawlerResults.items || [];
  Apify.client.setOptions({ storeId });

  const record = await keyValueStores.getRecord({ key: 'STATE' });
  const storeRecord = record && record.body ? record.body : [];
  const previousState = typeof storeRecord === 'string' ? JSON.parse(storeRecord) : storeRecord;
  console.log('Previous STATE results:', previousState.length);

  // Get the unique id
  const [firstItem] = previousState || [{}];
  const uniqueId = Object.keys(firstItem).find(key => /id/i.test(key));

  const results = items.map(({ pageFunctionResult }) => pageFunctionResult);
  console.log('Last execution results:', results.slice(0, 3));

  const memo = {};
  const nextState = previousState.concat(results).reduce((all, result) => {
    const key = result[uniqueId];
    if (memo[key]) {
      return all;
    }
    memo[key] = true;
    return all.concat(result);
  }, []);
  console.log('Next STATE unique results:', nextState.length);

  console.log('Saving into keyValueStore:', storeName);
  await keyValueStores.putRecord({
    key: 'STATE',
    body: pretty(nextState)
  });

  console.log('My output:');
  console.dir(output);
  await setValueRequest;
});

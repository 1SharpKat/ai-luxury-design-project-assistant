/* Keep explicitly nonbillable time out of the invoice queue. */

const getUnbilledEntriesIncludingNonbillable = getUnbilledEntries;

getUnbilledEntries = function getInvoiceableUnbilledEntries() {
  return getUnbilledEntriesIncludingNonbillable().filter(
    (entry) => entry.laborType !== "Nonbillable"
  );
};

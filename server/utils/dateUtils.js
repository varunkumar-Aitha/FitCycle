/**
 * Date utility functions for the server
 */

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const differenceInDays = (dateLeft, dateRight) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((dateLeft - dateRight) / msPerDay);
};

module.exports = { startOfDay, endOfDay, differenceInDays };

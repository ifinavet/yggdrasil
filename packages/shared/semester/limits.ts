// Input limits for semester planning, shared by Bifrost, Hugin and the backend so they agree.

/** The years a semester can be created for. */
export const MIN_SEMESTER_YEAR = 2000;
export const MAX_SEMESTER_YEAR = 2100;

/** How many days a company can be given to answer an offer. */
export const MIN_OFFER_RESPONSE_DAYS = 1;
export const MAX_OFFER_RESPONSE_DAYS = 60;

/** The longest room or location, and the longest internal notes, an editor can save. */
export const MAX_ROOM_LENGTH = 200;
export const MAX_INTERNAL_NOTES_LENGTH = 5000;

/** How many other dates a company can ask for, and how long its comment can be. */
export const MAX_REQUESTED_DATES = 10;
export const MAX_OFFER_COMMENT_LENGTH = 1000;

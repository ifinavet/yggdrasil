// Input limits for semester planning, shared by Bifrost, Hugin and the backend so they agree.

/** The years a semester can be created for. */
export const MIN_SEMESTER_YEAR = 2000;
export const MAX_SEMESTER_YEAR = 2100;

/** The longest internal notes an editor can save. */
export const MAX_INTERNAL_NOTES_LENGTH = 5000;

/** How many medhjelpere from Navet an event can have, next to the kontaktperson. */
export const MAX_HELPERS = 2;

/** How many other dates a company can ask for, and how long its comment can be. */
export const MAX_REQUESTED_DATES = 10;
export const MAX_OFFER_COMMENT_LENGTH = 1000;

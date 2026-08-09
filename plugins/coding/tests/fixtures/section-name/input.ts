export interface User {
  // violation: lowercase section name
  // --- identifiers --- //
  id: string;

  // violation: non-standard name where a standard one applies
  // --- LOGIN STUFF --- //
  passwordHash: string;

  // compliant: standard UPPERCASE section name
  // --- TIMESTAMPS --- //
  createdAt: Date;

  // compliant: standard multi-word section name
  // --- AUTHENTICATION DETAILS --- //
  lastLogin: Date;
}

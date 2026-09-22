# Firestore Security Specification - Datumprikker App

This document details the security specification, invariants, and test coverage for the Datumprikker application's Firestore database instance.

## 1. Core Data Invariants

1. **User Ownership (ABAC)**: Polls, Contacts, and Notifications belong to a specific logged-in organizer. No third party or other signed-in organizer can retrieve or list these records.
2. **Relational Sync Integrity**: Invitees and Notifications must be linked to a valid parent Poll document that exists in the database.
3. **Immutability Invariant**: Fields like `createdAt` and `ownerId` must never be altered once created.
4. **Voters' Privilege Isolation**: Voters can write to `/invitees` (to vote or comment) and `/notifications` (to trigger organizers' dashboard events), but they cannot modify properties of `/polls` (excluding finalized state which is exclusively managed by the poll organizer).

---

## 2. The "Dirty Dozen" Malicious Payloads

1. **Identity Spoofing**: Attempt to specify another user's UID as `ownerId` during Poll creation.
2. **Ghost Field Exposure (Shadow fields)**: Inject an unlisted attribute `isAdmin: true` into a Poll or Contact payload.
3. **Resource Poisoning (Junk document ID)**: Set a poll ID with length > 128 or containing dangerous path injections.
4. **Email Spoofing (PII Leak)**: Query another user's contact details by guessing public fields or bypass ownership.
5. **Orphaned Registration**: Write a new record to `/invitees` linked to a non-existent `pollId`.
6. **Self-Approved Finalization**: Guest voter attempts to finalize/approve a slot on behalf of the organizer by updating `/polls/{pollId}/finalizedOptionId`.
7. **Cross-Tenant Access Leak (Insecure List)**: Execute an unrestricted list query on `/polls` or `/contacts` without restricting the matching `ownerId`.
8. **Negative/Giant Duration Attack**: Save a Poll proposed slot option with a negative or massive duration value (e.g. `durationMin = -999999`).
9. **Duplicate Invitation Hijack**: Write an invitee record where the voter ID is valid but the `email` field is blank or not structured as an e-mail address.
10. **Admin Claim Bypass**: Set an admin claim inside client payload without being registered in `/admins`.
11. **Historic Timestamp Forgery**: Send a fake client timestamp for `createdAt` instead of leveraging Firestore's server-side `request.time`.
12. **Denial-of-Wallet Recursive Attack**: Issue a highly repetitive client loop on deep list queries containing complex `get()` statements.

---

## 3. Firestore Rules Structure & Draft Specification

To defeat all Dirty Dozen payloads, we implement the **Fortress** layout pattern:
- **Default Deny**: `match /{document=**} { allow read, write: if false; }`
- **Validation Helpers**: Reusable, atomic validation blocks.
- **Strict Keys**: Exact map key sizes on create, and `affectedKeys().hasOnly(...)` triggers on update.

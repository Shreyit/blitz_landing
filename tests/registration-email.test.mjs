import test from "node:test";
import assert from "node:assert/strict";
import { EMAIL_DOMAINS, emailInput, registrationEmail } from "../src/lib/registration-email.ts";

test("the username combines with either of the two institutional domains", () => {
  assert.deepEqual(EMAIL_DOMAINS, ["stud.tiss.ac.in", "stud.tiss.edu"]);
  assert.equal(registrationEmail("m2024bsass027", EMAIL_DOMAINS[0]), "m2024bsass027@stud.tiss.ac.in");
  assert.equal(registrationEmail("m2024bsass027", EMAIL_DOMAINS[1]), "m2024bsass027@stud.tiss.edu");
  assert.equal(registrationEmail(" M2024BSASS027 ", EMAIL_DOMAINS[0]), "m2024bsass027@stud.tiss.ac.in");
  assert.equal(registrationEmail("   ", EMAIL_DOMAINS[0]), "");
});

test("full-address paste and autofill select the matching domain without duplicating it", () => {
  for (const domain of EMAIL_DOMAINS) {
    const value = emailInput(` M2024BSASS027@${domain.toUpperCase()} `, "stud.tiss.edu");
    assert.equal(value.username, "M2024BSASS027");
    assert.equal(value.domain, domain);
    assert.equal(registrationEmail(value.username, value.domain), `m2024bsass027@${domain}`);
  }
});

test("username edits keep the selected domain and unsupported full addresses are not silently rewritten", () => {
  assert.deepEqual(emailInput("m2024bsass027", "stud.tiss.edu"), { username: "m2024bsass027", domain: "stud.tiss.edu" });
  for (const address of ["m2024bsass027@example.com", "m2024bsass027@stud.tis.ac.in", "m2024bsass027@tiss.edu", "m2024bsass027@stud.tiss.edu.evil"]) {
    assert.deepEqual(emailInput(address, "stud.tiss.ac.in"), { username: address, domain: "stud.tiss.ac.in" });
  }
});

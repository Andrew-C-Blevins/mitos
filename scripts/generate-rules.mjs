import { writeFile } from 'node:fs/promises';

// Rules cannot iterate over lists. Generate bounded checks so every checked field
// in a proposal can change without allowing edits to its authoritative payload.
const checks = Array.from(
  { length: 40 },
  (_, i) =>
    `(before.size() <= ${i} || (after[${i}].checked is bool && after[${i}].diff(before[${i}]).affectedKeys().hasOnly(['checked'])))`,
).join('\n        && ');
const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Emulator identities only. Production rendering must use ALLOWED_EMAILS.
    function allowed() {
      return request.auth != null && request.auth.token.email_verified == true
        && request.auth.token.email in ['andrew@mitos.test', 'karen@mitos.test'];
    }
    function member(householdId) {
      return allowed() && request.auth.uid in get(/databases/$(database)/documents/households/$(householdId)).data.memberUids;
    }
    function personId() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.personId; }
    function access(item) {
      return member(item.householdId) && (item.scope == 'household' || personId() in item.ownerPersonIds);
    }
    function optionalText(data, key, max) { return !(key in data) || (data[key] is string && data[key].size() <= max); }
    function optionalDate(data, key) { return !(key in data) || (data[key] is string && data[key].matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')); }
    function optionalTimestamp(data, key) { return !(key in data) || data[key] is timestamp; }
    function validNeed(n) { return n.keys().hasOnly(['id', 'text', 'kind', 'satisfied', 'waitingOn']) && n.id is string && n.text is string && n.text.size() > 0 && n.text.size() <= 4000 && n.kind in ['material', 'person', 'info', 'decision'] && n.satisfied is bool && optionalText(n, 'waitingOn', 4000); }
    function validQuestion(q) { return q.keys().hasOnly(['id', 'text', 'createdAt']) && q.id is string && q.text is string && q.text.size() > 0 && q.text.size() <= 4000 && q.createdAt is timestamp; }
    function validDecision(d) { return d.keys().hasOnly(['id', 'text', 'rationale', 'decidedAt', 'fromQuestionId']) && d.id is string && d.text is string && d.text.size() > 0 && d.text.size() <= 4000 && d.decidedAt is timestamp && optionalText(d, 'rationale', 4000) && optionalText(d, 'fromQuestionId', 128); }
    function validStep(s) { return s.keys().hasOnly(['id', 'text', 'done']) && s.id is string && s.text is string && s.text.size() > 0 && s.text.size() <= 4000 && s.done is bool; }
    function validLink(l) { return l.keys().hasOnly(['id', 'url', 'label', 'kind']) && l.id is string && l.label is string && l.label.size() > 0 && l.label.size() <= 4000 && l.url is string && l.url.matches('https?://.*') && l.kind in ['chat', 'reference', 'hearth']; }
    // Human inline adds/edits change one entry per section. Validate only the new
    // value, not every old entry, keeping large items within the rules budget.
    function validNestedChange(before, after, kind) {
      let added = after.removeAll(before);
      return added.size() <= 1 && (added.size() == 0
        || (kind == 'needs' && validNeed(added[0]))
        || (kind == 'questions' && validQuestion(added[0]))
        || (kind == 'decisions' && validDecision(added[0]))
        || (kind == 'steps' && validStep(added[0]))
        || (kind == 'links' && validLink(added[0])));
    }
    function validNestedChanges(before, after) {
      return (before.needs == after.needs || validNestedChange(before.needs, after.needs, 'needs'))
        && (before.questions == after.questions || validNestedChange(before.questions, after.questions, 'questions'))
        && (before.decisions == after.decisions || validNestedChange(before.decisions, after.decisions, 'decisions'))
        && (before.steps == after.steps || validNestedChange(before.steps, after.steps, 'steps'))
        && (before.links == after.links || validNestedChange(before.links, after.links, 'links'));
    }
    function validItem(d) {
      return d.keys().hasAll(['title', 'status', 'scope', 'householdId', 'ownerPersonIds', 'createdBy', 'category', 'effort', 'focus', 'contexts', 'businessHours', 'needs', 'questions', 'decisions', 'steps', 'links', 'sortKey', 'version', 'createdAt', 'updatedAt'])
        && d.keys().hasOnly(['title', 'intent', 'status', 'scope', 'householdId', 'ownerPersonIds', 'createdBy', 'category', 'outcome', 'nextAction', 'effort', 'focus', 'contexts', 'businessHours', 'dueDate', 'targetDate', 'snoozeUntil', 'availableFrom', 'needs', 'questions', 'decisions', 'steps', 'links', 'recurrence', 'parentId', 'sortKey', 'version', 'historicalOwnerNames', 'createdAt', 'updatedAt', 'completedAt'])
        && d.title is string && d.title.size() > 0 && d.title.size() <= 500
        && d.status in ['inbox', 'active', 'done', 'cancelled'] && d.scope in ['private', 'household']
        && d.householdId is string && d.createdBy is string
        && d.ownerPersonIds is list && d.ownerPersonIds.size() <= 10
        && (d.scope != 'private' || d.ownerPersonIds.size() > 0)
        && d.category in ['home', 'family', 'finance-admin', 'personal', 'work']
        && d.effort in ['quick', 'sitting', 'multi'] && d.focus in ['low', 'normal', 'high']
        && d.contexts is list && d.contexts.size() <= 5 && d.contexts.hasOnly(['computer', 'phone', 'home', 'yard', 'errand'])
        && d.businessHours is bool
        && d.needs is list && d.needs.size() <= 40 && d.questions is list && d.questions.size() <= 40
        && d.decisions is list && d.decisions.size() <= 40 && d.steps is list && d.steps.size() <= 40 && d.links is list && d.links.size() <= 40
        && d.sortKey is string && d.sortKey.size() > 0 && d.sortKey.size() <= 100
        && d.version is int && d.version > 0 && d.createdAt is timestamp && d.updatedAt is timestamp
        && optionalText(d, 'intent', 4000) && optionalText(d, 'outcome', 4000) && optionalText(d, 'nextAction', 4000)
        && optionalDate(d, 'dueDate') && optionalDate(d, 'targetDate') && optionalDate(d, 'snoozeUntil') && optionalDate(d, 'availableFrom')
        && optionalTimestamp(d, 'completedAt')
        && (!('recurrence' in d) || (d.recurrence is map && d.recurrence.keys().hasOnly(['kind', 'rule', 'intervalDays', 'season', 'lastCompletedAt'])
          && ((d.recurrence.kind == 'calendar' && d.recurrence.rule is string && d.recurrence.rule.size() <= 500)
            || (d.recurrence.kind == 'afterCompletion' && d.recurrence.intervalDays is int && d.recurrence.intervalDays >= 1 && d.recurrence.intervalDays <= 3650))
          && optionalTimestamp(d.recurrence, 'lastCompletedAt')
          && (!('season' in d.recurrence) || (d.recurrence.season.keys().hasOnly(['start', 'end']) && d.recurrence.season.start is string && d.recurrence.season.end is string))))
        && (!('historicalOwnerNames' in d) || d.historicalOwnerNames is list);
    }
    function validParent(d, itemId) {
      return !('parentId' in d) || (d.parentId != itemId
        && !('parentId' in getAfter(/databases/$(database)/documents/items/$(d.parentId)).data)
        && getAfter(/databases/$(database)/documents/items/$(d.parentId)).data.householdId == d.householdId
        && getAfter(/databases/$(database)/documents/items/$(d.parentId)).data.scope == d.scope
        && getAfter(/databases/$(database)/documents/items/$(d.parentId)).data.ownerPersonIds == d.ownerPersonIds);
    }
    match /households/{householdId} { allow read: if member(householdId); allow write: if false; }
    match /people/{id} {
      allow read: if member(resource.data.householdId);
      allow update: if member(resource.data.householdId) && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']) && request.resource.data.status in ['active', 'archived'];
      allow create, delete: if false;
    }
    match /users/{uid} {
      allow read: if allowed() && request.auth.uid == uid;
      allow update: if allowed() && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['email', 'name', 'defaultContext'])
        && request.resource.data.email == request.auth.token.email && request.resource.data.name is string
        && (!('defaultContext' in request.resource.data) || request.resource.data.defaultContext in ['computer', 'phone', 'home', 'yard', 'errand']);
      allow create, delete: if false;
    }
    match /items/{id} {
      allow read: if access(resource.data);
      allow create: if access(request.resource.data) && validItem(request.resource.data) && validParent(request.resource.data, id)
        && request.resource.data.needs.size() == 0 && request.resource.data.questions.size() == 0 && request.resource.data.decisions.size() == 0 && request.resource.data.steps.size() == 0 && request.resource.data.links.size() == 0
        && request.resource.data.createdBy == request.auth.uid && request.resource.data.version == 1
        && getAfter(/databases/$(database)/documents/items/$(id)/log/capture).data.by == request.auth.uid
        && getAfter(/databases/$(database)/documents/items/$(id)/log/capture).data.kind == 'capture';
      allow update: if access(resource.data) && access(request.resource.data) && validItem(request.resource.data) && validParent(request.resource.data, id)
        && validNestedChanges(resource.data, request.resource.data)
        && request.resource.data.createdBy == resource.data.createdBy && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.householdId == resource.data.householdId && request.resource.data.version == resource.data.version + 1;
      // Cancellation preserves the permanent capture and the rest of the log.
      allow delete: if false;
      match /log/{entryId} {
        allow read: if access(get(/databases/$(database)/documents/items/$(id)).data);
        allow create: if access(getAfter(/databases/$(database)/documents/items/$(id)).data)
          && request.resource.data.keys().hasOnly(['at', 'by', 'kind', 'text'])
          && request.resource.data.by == request.auth.uid && request.resource.data.at is timestamp
          && request.resource.data.kind in ['capture', 'note', 'status', 'migrated']
          && request.resource.data.text is string && request.resource.data.text.size() > 0 && request.resource.data.text.size() <= 4000
          && (request.resource.data.kind != 'capture' || (entryId == 'capture' && !exists(/databases/$(database)/documents/items/$(id))));
        allow update, delete: if false;
      }
    }
    function checkedOnly(before, after) {
      return before is list && after is list && before.size() == after.size() && before.size() <= 40
        && ${checks};
    }
    match /proposals/{id} {
      // New-item proposals have no target ACL in the brief. Fail closed until M3
      // explicitly defines the creator/household envelope for them.
      allow read: if resource.data.targetItemId is string && access(get(/databases/$(database)/documents/items/$(resource.data.targetItemId)).data);
      allow update: if resource.data.targetItemId is string && access(get(/databases/$(database)/documents/items/$(resource.data.targetItemId)).data)
        && resource.data.status == 'pending'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'changes'])
        && request.resource.data.status in ['pending', 'discarded']
        && checkedOnly(resource.data.changes, request.resource.data.changes);
      allow create, delete: if false;
    }
    match /credentials/{uid} { allow read, write: if false; }
    match /{document=**} { allow read, write: if false; }
  }
}
`;
await writeFile('firestore.rules', rules);

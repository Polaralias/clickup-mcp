# Live Runtime Tool Tests

Date of probe: 2026-05-16

This report validates selected tools through the actual server runtime path:

- environment configured with live ClickUp credentials
- `server.runtime.dispatch(...)` invoked directly
- disposable test artifacts created in the workspace and cleaned up afterwards

## Test Setup

Disposable artifacts used:

- temporary list in the `Planning` space
- temporary task inside that list
- temporary tag name used for tagging probes

Cleanup completed:

- temporary task deleted
- temporary list deleted
- temporary space tag deleted

## Read Tool Results

### `member_list_for_workspace`

Runtime:

- [server.py](../server.py#L1186)

Result:

- failed
- error: `ClickUp 404: 404 page not found`

Conclusion:

- live-confirmed broken

### `doc_page_list`

Runtime:

- [server.py](../server.py#L1446)

Result:

- failed
- error: `ClickUp 404: 404 page not found`

Conclusion:

- live-confirmed broken

### `doc_page_read`

Runtime:

- [server.py](../server.py#L1451)

Result:

- failed
- error: `ClickUp 404: 404 page not found`

Conclusion:

- live-confirmed broken

### `doc_pages_read`

Runtime:

- [server.py](../server.py#L1441)

Result:

- failed
- error: `ClickUp 404: 404 page not found`

Conclusion:

- live-confirmed broken

## Write Tool Results

### `list_create_for_container`

Runtime:

- [server.py](../server.py#L1242)

Result:

- succeeded

Conclusion:

- basic list creation path is live-valid

### `task_create`

Runtime:

- [server.py](../server.py#L1307)

Result:

- succeeded

Conclusion:

- single-task creation path is live-valid

### `task_duplicate`

Runtime:

- [server.py](../server.py#L1319)

Result:

- failed
- error: `ClickUp 404: 404 page not found`

Conclusion:

- live-confirmed broken

### `task_create_bulk`

Runtime:

- [server.py](../server.py#L1338)

Result:

- failed
- error: `ClickUp 405: 405 method not allowed`

Conclusion:

- live-confirmed broken for the current implementation

### `task_update_bulk`

Runtime:

- [server.py](../server.py#L1344)

Result:

- failed
- error: `ClickUp 400: {"err":"Task ID invalid","ECODE":"INPUT_004"}`

Interpretation:

- current implementation is not behaving as intended
- this may be because the route shape or request body does not match live API expectations

Conclusion:

- not trustworthy in current form

### `task_delete_bulk`

Runtime:

- [server.py](../server.py#L1347)

Result:

- failed
- error: `ClickUp 401: {"err":"Team not authorized","ECODE":"OAUTH_027"}`

Interpretation:

- current implementation is not behaving as intended
- request semantics are likely wrong

Conclusion:

- not trustworthy in current form

### `task_tag_add`

Runtime:

- [server.py](../server.py#L1328)

Result:

- succeeded
- tag appeared on the live task

Additional observation:

- even though `space_tag_create` failed, `task_tag_add` still created or attached the tag successfully

Conclusion:

- single-task tag-add path is live-valid

### `task_tag_add_bulk`

Runtime:

- [server.py](../server.py#L1350)

Result:

- failed
- error: `ClickUp 404: 404 page not found`

Conclusion:

- live-confirmed broken

### `space_tag_create`

Runtime:

- [server.py](../server.py#L1207)

Result:

- failed
- error: `ClickUp 400: {"err":"Tag missing from body","ECODE":"TAGS_020"}`

Interpretation:

- the runtime currently sends the wrong payload shape
- this is not a route problem; it is a request-body problem

Conclusion:

- live-confirmed broken

### `task_delete`

Runtime:

- [server.py](../server.py#L1317)

Result:

- succeeded

Conclusion:

- single-task delete path is live-valid

### `list_delete`

Runtime:

- [server.py](../server.py#L1255)

Result:

- succeeded

Conclusion:

- list delete path is live-valid

## Summary

### Live-valid through runtime

- `list_create_for_container`
- `task_create`
- `task_tag_add`
- `task_delete`
- `list_delete`

### Live-confirmed broken through runtime

- `member_list_for_workspace`
- `doc_page_list`
- `doc_page_read`
- `doc_pages_read`
- `task_duplicate`
- `task_create_bulk`
- `task_tag_add_bulk`
- `space_tag_create`

### Live-failing and currently untrustworthy

- `task_update_bulk`
- `task_delete_bulk`

## Practical Conclusion

The current runtime is not in a state where bulk task operations, member listing, or docs-page tools can be trusted.

The strongest repair candidates now have direct live evidence:

1. member lookup implementation
2. docs page route construction
3. list-template path shape
4. task duplicate path
5. bulk task operation implementations
6. bulk tag implementation
7. space tag create payload shape

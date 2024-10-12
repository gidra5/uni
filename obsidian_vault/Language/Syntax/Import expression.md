An expression that specifies a file import.

```
import = "import" path ("as" pattern)
path = absolute | relative | foreign
absolute = "/" rest?
relative = relative_path_item ("/" rest?)?
foreign = path_name ("/" rest?)?
rest = path_item ("/" path_item?)*
path_item = relative_path_item | path_name
path_name = [^/]+
relative_path_item = "." | ".."
```
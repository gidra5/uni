An expression that specifies a file import.

```
import = "import" path ("as" pattern)
path = absolute | relative | foreign
absolute = "/" (path_name "/")* path_name?
relative = ("./" | "../") (path_name "/")* path_name?
foreign = path_name ("/" (path_name "/")* path_name?)?
```
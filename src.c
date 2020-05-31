#include <stdio.h>
#include <string.h>

FILE *src;
char currentChar;

void nextChar()
{
    currentChar = fgetc(src);
}

void Error(const char* message) {
    printf(message);
    exit(1);
}

char* identifier() {
    char *id;
    char tmp[2];
    id = strcpy(tmp, &currentChar);

    if (isalpha(currentChar)) //check if char is a letter
        nextChar();
    else
        Error("expected identifier\n");

    while(isalnum(currentChar)) { //check if char is a letter or a digit
        char tmp[strlen(id) + 2];
        strcpy(tmp, id);
        id = strcat(tmp, &currentChar);
        nextChar();
    }

    return id;
}

char** Arr() {
    char **ids;
    int idsSize = 1;

    if(currentChar == '(')
        nextChar();
    else
        Error("expected opening bracket\n");

    while(currentChar == ',') {
        nextChar();
        ++idsSize;
    }

    if(currentChar == ')')
        nextChar();
    else
        Error("expected closing bracket\n");
}

void ArR() {
    if(currentChar == '(')
        nextChar();
    else
        Error("expected opening bracket\n");

    rule();
    while(currentChar == ',') {
        nextChar();
        rule();
    }

    if(currentChar == ')')
        nextChar();
    else
        Error("expected closing bracket\n");
}

void rule() {
    identifier();
    while(currentChar == '-') {
        nextChar();
        identifier();
    }

    if(currentChar == '=')
        nextChar();
    else
        Error("incorrect syntax of rule\n");
    if(currentChar == '>')
        nextChar();
    else
        Error("incorrect syntax of rule\n");

    identifier();
    while(currentChar == '-') {
        nextChar();
        identifier();
    }
}

void grammar() {
    identifier();

    if(currentChar == '(')
        nextChar();
    else
        Error("expected opening bracket\n");

    Arr();

    if(currentChar == ',') {
        nextChar();
        Arr();
    } else Error("expected set of identifiers\n");

    if (currentChar == ',') {
        nextChar();
        ArR();
    } else Error("expected set of rules\n");

    if (currentChar == ',') {
        nextChar();
        identifier();
    } else Error("expected an identifier\n");

    if (currentChar == ')')
        nextChar();
    else
        Error("expected closing bracket\n");
}

int main(int argc, const char** args) {
    if(argc <= 1){
        printf("Enter filepath, pleeeease.\n");
        return 0;
    }
    src = fopen(args[1], "r");
    if(src == NULL) {
        printf("No such file\n");
        return 0;
    }

    // printf("Starting parser... Input string:\n");
    nextChar();

    grammar();

    return 0;
}
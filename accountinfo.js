/*
+   add or replace callback(s) to event
-   remove or clear callback(s) from event
->  event fired
,   seperates linear program flow

Program flow
------------
script load, +window.load: afterLoad
->window.load, afterload
afterload, getData
getData, +xhr.readyStateChange: processResponse
->xhr.readyStateChange, processResponse
processResponse, processAccountData
processResponse, +window.timeout: retry
->window.timeout, retry
retry, -window.timout: retry, getData
processAccountData, showAccount, ShowTransactions
showAccount.
showTransactions, +th.click: sortOnColumn 
->th.click, sortOnColumn, reverseHtmlTable, sortHtmlTable

Helper functions:
----------------
showRetryStatus
getCurrency
getHeaderIDs
amountHelper.jsonToString
amountHelper.compareAmounts
dateHelper.jsonToString
dateHelper.dateToString
dateHelper.stringToDate
dateHelper.compareDates
addClickHandler
getParentTable

*/

// Wait until the page is loaded
window.addEventListener("load", afterLoad);

// Eventhandler for window.load
function afterLoad() {
    // get accountinfo from nodeserver and display it
    getData("http://localhost:8080/api/getbalance");
}

// Get JSON from our nodejs server
// Add eventhandler for xhr.readyStateChange: processResponse
function getData(DataURL) {
    // Get the account information from the nodejs server
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = processResponse;
    xhr.open("GET", DataURL, true);
    xhr.send();
}

// Eventhandler for xhr.readyStateChange added in getData 
function processResponse() {
    // Callback. 'this' refers to the xmlhttprequest object in getData
    if (this.readyState == 4 && this.status == 200) {
        // Received data from DataURL
        processAccountData(this.responseText);
    }
    if (this.readyState == 4 && this.status != 200) {
        // Some error occured getting the transaction data
        // Set retry timer. No limit yet on number of retries
        showRetryStatus();
        window.setTimeout(retry, 3000);
    }
}

// Parse received JSON data and show it on the page
function processAccountData(JSONString) {
    // Parsing JSON could fail
    try {
        var obj = JSON.parse(JSONString);
    }
    catch (err) {
        if (err.name == "SyntaxError") {
            // Invalid JSON
            alert("Error parsing account information, invalid JSON");
        }
    }
    showAccount(obj);
    showTransactions(obj);
}

// Dynamically add a message to the page showing that we are retrying to get the data
function showRetryStatus() {
    // Add a status message to the page
    var StatusDiv = document.createElement("div");
    StatusDiv.id = "RetryStatus";
    StatusDiv.innerHTML = "Communication error, retrying...";
    document.body.appendChild(StatusDiv);
}

// Eventhandler for window.timeout
// Clear all eventhandlers for window.timeout, remove message from page and run getData again
function retry() {
    // Callback. Retry after communication error, remove status message
    window.clearTimeout()
    document.body.removeChild(document.getElementById("RetryStatus"));
    getData("http://localhost:8080/api/getbalance");
}

// Add the account data to the appropriate fields on the page
function showAccount(AccountData) {
    // Show the account information
    var AccountHolder = AccountData.account.name;
    var Iban = AccountData.account.iban;
    var Balance = AccountData.account.balance;
    document.getElementById("account_name").innerHTML = AccountHolder;
    document.getElementById("account_iban").innerHTML = Iban;
    // Append the currency type to the balance
    document.getElementById("account_balance").innerHTML = Balance + " " + getCurrency(AccountData);
}

// Get the currency type from the transaction data
function getCurrency(AccountData) {
    return AccountData.currency;
}

// Show the transactions in the JSON data ('AccountData') on the page
function showTransactions(AccountData) {
    // Order of data is based on the table header id's
    var Table = document.getElementById("transactions").getElementsByTagName("TABLE")[0];
    // Create a dictionary of column id's -> column index
    var ColumnIDs = getHeaderIDs(Table);
    // Add click handler to table headers
    var TableHeader = Table.getElementsByTagName("TH");
    for (col = 0; col < TableHeader.length; col++) {
        // Add a click handler to each header element to facilitate sorting of the table
        addClickHandler(TableHeader[col], sortOnColumn);
    }

    // Get the transaction list from the JSON data
    var Transactions = AccountData["debitsAndCredits"];
    // Add each transaction to the (only) table in the transactions div    
    for (var t = 0; t < Transactions.length; t++){
        // Each row needs some html elements        
        var NewRow = document.createElement("TR");
        var NameCol = document.createElement("TD");
        var ReceivedMoneyCol = document.createElement("TD");
        var DescriptionCol = document.createElement("TD");
        var AmountCol = document.createElement("TD");
        var DateCol = document.createElement("TD");

        // 'Name' is determined by 'from' or 'to' field
        // Assume 'from' and 'to' are mutually exclusive and you receive money from a 'from' entry
        var NameField = Transactions[t].hasOwnProperty("from") ? "from" : "to";
        var ReceivedMoneyValue = NameField == "from" ? "Credit" : "Debit";
        NameCol.innerHTML = Transactions[t][NameField];
        ReceivedMoneyCol.innerHTML = ReceivedMoneyValue;

        // 'Description' column is determined by 'description' field
        DescriptionCol.innerHTML = Transactions[t]["description"];

        // 'Amount' column is determined by 'amount' or 'debit' field
        // Assume 'amount' and 'debit' are mutually exclusive
        var AmountField = Transactions[t].hasOwnProperty("amount") ? "amount" : "debit";
        // Format the number for better readability
        AmountCol.innerHTML = amountHelper.jsonToString(Transactions[t][AmountField]);
        // Apply styling to currency data column        
        AmountCol.classList.add("Currency");

        // Based on example data, the date looks like javascript date
        DateCol.innerHTML = dateHelper.jsonToString(Transactions[t]["date"]);

        // Add the fields in the correct column order to a sparse array
        // Use the ColumnIDs dict to determine the order of the columns on the html page
        Cols = [];
        Cols[ColumnIDs["name"]] = NameCol;
        Cols[ColumnIDs["description"]] = DescriptionCol;
        Cols[ColumnIDs["amount"]] = AmountCol;
        Cols[ColumnIDs["date"]] = DateCol;
        Cols[ColumnIDs["creditordebit"]] = ReceivedMoneyCol;
        for (var col = 0; col < Cols.length; col++) {
            NewRow.appendChild(Cols[col]);
        }
        // Append the row to the table
        Table.getElementsByTagName("TBODY")[0].appendChild(NewRow);
    }
}

// Eventhandler tableSort. Sort a html table on the column that was clicked
// The 'this' keyword refers to the DOM element that was clicked
// This function does not use the underlying data structure that was used to generate the html,
//  it only uses the html itself 
function sortOnColumn() {
    // Unicode arrow characters are used to simplify coding
    // These will not display correctly in an ascii text editor
    var SortIndicatorDescending = "↑";
    var SortIndicatorAscending = "↓";
    var SortIndicatorBoth = "↕";
    
    // id of the TH element that will be the new column that must be sorted on    
    var NewSortColumn = this.id;
    
    // Get the parent table of the clicked child element
    var pt = getParentTable(this);
    
    // Get the last character of the text in the th column that was clicked
    // Program flow depends on that character
    var CurrentSortOrder = this.innerHTML.slice(-1);

    // Shortcuts: If the rows which must be sorted are already in a ascending or descending order,
    //  just reverse the table rows
    if (CurrentSortOrder == SortIndicatorDescending) {
        // Change sort indicator to ascending
        this.innerHTML = this.innerHTML.slice(0, this.innerHTML.length - 1) + SortIndicatorAscending;
        // Reverse the sort order (easy in this case, just reverse the table row order)
        reverseHtmlTable(pt.getElementsByTagName("TBODY")[0].getElementsByTagName("TR"));
    }
    else if (CurrentSortOrder == SortIndicatorAscending) {
        // Change sort indicator to descending
        this.innerHTML = this.innerHTML.slice(0, this.innerHTML.length - 1) + SortIndicatorDescending;
        // Reverse the sort order (easy in this case, just reverse the table row order)
        reverseHtmlTable(pt.getElementsByTagName("TBODY")[0].getElementsByTagName("TR"));
    }
    else if (!(CurrentSortOrder == SortIndicatorDescending || CurrentSortOrder == SortIndicatorAscending)) {
        // Column that was clicked is unsorted. Table must be sorted        
        // Replace sort indicator in all columns with SortIndicatorBoth
        // Removing the sort indicator completely would make the table columns change width slightly
        //  each time a different column is clicked, which looks odd
        var Headers = this.parentElement.getElementsByTagName("TH");
        for (var col = 0; col < Headers.length; col++) {
            var Header = Headers[col];
            var LastChar = Header.innerHTML.slice(-1);
            if (LastChar == SortIndicatorAscending || LastChar == SortIndicatorDescending) {
                Header.innerHTML = Header.innerHTML.slice(0, Header.innerHTML.length - 1) + SortIndicatorBoth;
            }
        } 
        // Add 'descending' sort indicator to this column
        this.innerHTML = this.innerHTML.slice(0, this.innerHTML.length - 1) + SortIndicatorDescending;
        
        // Sort table 'pt' on column with id 'this.id' in descending order ('false')
        sortHtmlTable(pt, this.id, false);
    }
}

// getHeaderIDs builds a dictionary of header column id -> column index
function getHeaderIDs(Table) {
    // Get a reference to the header elements    
    var TableHeader = Table.getElementsByTagName("TH");
    // Dictionary to hold column id -> column index information     
    var ColumnIDs = {};
    // Loop through header elements and store the order of the elements in a dictonary
    for (var col = 0; col < TableHeader.length; col++) {
        // Create a dictionary of header column id -> column index
        // This is used later to match the data columns to the header columns
        ColumnIDs[TableHeader[col].id] = col;
    }
    return ColumnIDs;
}

// amountHelper contains helper functions for converting and comparing amounts 
var amountHelper = {
    // Create a amount string with at least 1 digit in the whole part an 2 digits in the fractional part
    jsonToString: function (jsonAmount) {
        jsonAmount = String(jsonAmount);
        // Split the currency value in a whole and fraction part
        var AmountWhole = jsonAmount.split(".")[0];
        var AmountFraction = jsonAmount.split(".")[1];
        // If whole part is undefined change it to 0
        AmountWhole = AmountWhole === undefined ? "0" : AmountWhole;
        // If fraction is undefined change it to 00, else fallthrough
        AmountFraction = AmountFraction === undefined ? "00" : AmountFraction;
        // If fraction is a single digit, add a trailing zero
        AmountFraction = AmountFraction.length == 1 ? AmountFraction + "0" : AmountFraction;
        return AmountWhole + "." + AmountFraction;
    },
    // Compare two 'amount' strings
    compareAmounts: function (htmlAmount1, htmlAmount2, ascending) {
        var whole1 = htmlAmount1.split(".")[0];
        var fraction1 = htmlAmount1.split(".")[1];
        var whole2 = htmlAmount2.split(".")[0];
        var fraction2 = htmlAmount2.split(".")[1];
        if (ascending) {
            if (whole1 - whole2 == 0) {
                return fraction1 - fraction2;
            }
            else {
                return whole1 - whole2;
            }
        }
        else {
            if (whole2 - whole1 == 0) {
                return fraction2 - fraction1;
            }
            else {
                return whole2 - whole1;
            }
        }
    }
}

// dateHelper contains helper functions for converting and comparing dates
var dateHelper = {
    // Convert date from json to a human readable string according to our own formatting rules
    // Date format: Y-M-D H:M
    jsonToString: function (jsonDate) {
        var NewDate = new Date(jsonDate);
        return dateHelper.dateToString(NewDate);
    },
    // stringToDate converts our own human readable date into a js date object
    stringToDate: function (htmlDate) {
        var DatePart = htmlDate.split(" ")[0].split("-");
        var TimePart = htmlDate.split(" ")[1].split(":");
        // Return a new date object, note that the date constructor expects a 0 based monthnumber
        return new Date(DatePart[0], DatePart[1] - 1, DatePart[2], TimePart[0], TimePart[1]);
    },
    // Convert a date object to our own human readable string format
    dateToString: function (date) {
        // Convert Month, Day, Hour, Seconds to 2 digit strings. js Month and Day are 0 based
        var Month = date.getMonth() <= 8 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1);
        var Day = date.getDate() <= 8 ? "0" + (date.getDate() + 1) : (date.getDate() + 1);
        var Hours = date.getHours() <= 9 ? "0" + date.getHours() : date.getHours();
        var Minutes = date.getMinutes() <= 9 ? "0" + date.getMinutes() : date.getMinutes();
        return date.getFullYear() + "-" + Month + "-" + Day + " " + Hours + ":" + Minutes;
    },
    // Date comparison for sorting purposes 
    compareDates: function (htmlDate1, htmlDate2, ascending) {
        var Date1 = dateHelper.stringToDate(htmlDate1);
        var Date2 = dateHelper.stringToDate(htmlDate2);
        return ascending ? Date1 - Date2 : Date2 - Date1;    
    }
}

// Add a click handler (Callback) to a DOM object (DOMObj)
function addClickHandler(DOMObj, Callback) {
    DOMObj.addEventListener("click", Callback);
}

// Get the parent table element from a child of that table
// Implemented as a recursive function, safe because there is no infinite nesting
function getParentTable(tableChild) {
    // Find the parent table element
    if (tableChild.parentElement.nodeName == "TABLE") {
        return tableChild.parentElement;
    }
    else {
        return getParentTable(tableChild.parentElement);
    }
}

// Reverse the rows of a table
// This function can reverse any list of DOM elements as long as they have the same parent
function reverseHtmlTable(DOMTableRows) {
    // DOMTableRows is a reference to some table rows in the document
    // reverseTable will reverse the order of the rows
    var MoveRow, MoveBefore;
    for (var row = DOMTableRows.length - 1; row > 0; row--) {
        // Note: row > 0, because the last line will automatically be in the right order
        MoveRow = DOMTableRows[DOMTableRows.length-1];
        MoveBefore = DOMTableRows[(DOMTableRows.length-1) - row];
        DOMTableRows[0].parentElement.insertBefore(MoveRow, MoveBefore);    
    }
}

// Sort the table on the column indicated by column id in the order indicated by 'ascending'
function sortHtmlTable(DOMTable, ColumnID, ascending) {
    var HeaderIDs = getHeaderIDs(DOMTable);
    var HeaderIndex = HeaderIDs[ColumnID];
    var TableRows = DOMTable.getElementsByTagName("TBODY")[0].getElementsByTagName("TR");    
    // Map row index to the column value of the correct row    
    var RowMap = [];
    for (var row = 0; row < TableRows.length; row++) {
        RowMap[row] = {index: row, value: String(TableRows[row].getElementsByTagName("TD")[HeaderIndex].innerHTML)}; 
    }
    // Sort the row map
    if (ColumnID == "date") {
        RowMap.sort(function (Date1, Date2) { 
            return dateHelper.compareDates(Date1.value, Date2.value, ascending);});
    } 
    else if (ColumnID == "amount") {
        RowMap.sort(function(Amount1, Amount2) {
            return amountHelper.compareAmounts(Amount1.value, Amount2.value, ascending); 
        });
    } 
    else {
        // Other columns are strings, ignore case while sorting
        RowMap.sort(function (String1, String2) {
            if (ascending) {
                return String1.value.toLowerCase() < String2.value.toLowerCase();
            }
            else {
                return String2.value.toLowerCase() < String1.value.toLowerCase();
            }
        });
    }

    // Swap the table rows based on the row map
    var MoveRow, MoveBefore;
    for (var row = 0; row < RowMap.length; row++) {
        MoveRow = TableRows[RowMap[row].index];
        MoveBefore = TableRows[row];
        // All rows have the same parent, so use a random tablerow to determine the parent
        TableRows[0].parentElement.insertBefore(MoveRow, MoveBefore);
        // RowMap is now invalid, because the moved row has moved up, pushing the other rows down 
        // Fix the rest of RowMap, starting at row + 1
        for (var i = row+1; i < RowMap.length; i++) {
            // If the table row that is still to be sorted was above the row we just sorted (before we sorted it), 
            //  fix the index, because that row was pushed down. It's index is now 1 higher than it used to be,
            // to fix it, add 1 to its index
            if (RowMap[i].index < RowMap[row].index) {
                RowMap[i].index = RowMap[i].index + 1;
            }
        }
    }
}

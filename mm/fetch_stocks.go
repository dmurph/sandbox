package main

import (
	// "bytes"
	"fmt"
	"golang.org/x/net/html"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"text/tabwriter"
	"time"
)

type mrow struct {
	name        string
	symbol      string
	date        time.Time
	rec         int
	price       float64
	currPrice   float64
	last50Diff  float64
	last200Diff float64
	priceRange  string
}

type mrows []mrow

func (slice mrows) Len() int {
	return len(slice)
}

func Value(row mrow) int {
	var value = 0
	if row.last50Diff < 0 {
		value++
	}
	if row.last200Diff < 0 {
		value++
	}
	value += row.rec
	return value
}

func (slice mrows) Less(i, j int) bool {
	var iVal = Value(slice[i])
	var jVal = Value(slice[j])
	if iVal == jVal {
		return slice[i].date.UnixNano() > slice[j].date.UnixNano()
	}
	return iVal > jVal
}

func (slice mrows) Swap(i, j int) {
	slice[i], slice[j] = slice[j], slice[i]
}

func parse_row(n *html.Node) mrow {
	var s mrow

	var num = -1
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		// fmt.Printf("Got node type %s\n", c.Type)
		if c.Type != html.ElementNode {
			// fmt.Printf("Not using table element %s\n", c.Data);
			continue
		}
		num++

		//First td, title and ticker
		if num == 0 {
			var textWithName = c.FirstChild.Data
			s.name = textWithName[:len(textWithName)-2]
			s.symbol = c.FirstChild.NextSibling.FirstChild.Data
		}
		if num == 1 {
			var dateFields = strings.Split(c.FirstChild.Data, "/")
			var month, day int64
			month, _ = strconv.ParseInt(dateFields[0], 10, 64)
			day, _ = strconv.ParseInt(dateFields[1], 10, 64)
			var location, _ = time.LoadLocation("America/New_York")
			s.date = time.Date(time.Now().Year(), time.Month(int(month)), int(day), 0, 0, 0, 0, location)
		}
		if num == 3 {
			var found = false
			for _, a := range c.FirstChild.Attr {
				if a.Key == "alt" {
					i, err := strconv.Atoi(a.Val)
					if err != nil {
						log.Fatal(err)
					}
					found = true
					s.rec = i
				}
			}
			if !found {
				log.Fatal("Didn't find rank")
			}
		}
		if num == 4 {
			var price = c.FirstChild.Data
			price2, err := strconv.ParseFloat(price[1:len(price)], 64)

			if err != nil {
				log.Fatal(err)
			}
			s.price = price2
		}
	}

	return s
}

func parse_table(n *html.Node) {
	// print("parsing able\n")
	// buf := new(bytes.Buffer)
	// html.Render(buf, n);
	// fmt.Printf("Got HTML!\n%s", buf)

	tickerToData := make(map[string]mrow)

	for c := n.FirstChild.NextSibling.FirstChild.NextSibling.NextSibling; c != nil; c = c.NextSibling {
		// fmt.Printf("Got node type %s\n", c.Type)
		if c.Type != html.ElementNode {
			// fmt.Printf("Not using table element %s\n", c.Data);
			continue
		}
		if c.Data == "tr" {
			var row = parse_row(c)
			tickerToData[row.symbol] = row
		}
	}
	keys := make([]string, 0, len(tickerToData))
	for k := range tickerToData {
		keys = append(keys, k)
	}
	var all = strings.Join(keys, ",")
	// fmt.Println(all)
	var call = "http://finance.yahoo.com/d/quotes.csv?s=" + all + "&f=spm8m6w"
	// fmt.Println(call)

	resp, err := http.Get(call)
	if err != nil {
		log.Fatal(err)
	}
	htmlData, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}
	var body = string(htmlData)

	// fmt.Printf("%s\n", body)
	var prices = strings.Split(body, "\n")
	for _, i := range prices {
		if i == "" {
			continue
		}
		i = strings.Replace(i, "\"", "", -1)
		var sections = strings.SplitN(i, ",", 2)
		if len(sections) == 0 {
			continue
		}
		var prices = strings.SplitN(sections[1], ",", -1)
		row := tickerToData[sections[0]]
		row.currPrice, _ = strconv.ParseFloat(prices[0], 64)
		row.last50Diff, _ = strconv.ParseFloat(strings.TrimSuffix(prices[1], "%"), 64)
		row.last200Diff, _ = strconv.ParseFloat(strings.TrimSuffix(prices[2], "%"), 64)
		row.priceRange = prices[3]
		tickerToData[sections[0]] = row
	}

	resp.Body.Close()

	s := make(mrows, len(tickerToData))
	var i = 0
	for _, row := range tickerToData {
		s[i] = row
		i++
	}

	sort.Sort(s)

	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 5, 8, 1, '\t', 0)
	fmt.Fprintln(w, "Name\tDate\tCall\tSymbol\tPrice\tPrevious Close\t50 Day %\t200 Day %\t52 Weeks")
	for _, a := range s {
		if a.rec <= 3 {
			continue
		}
		if a.last50Diff > 0 && a.last200Diff > 0 {
			continue
		}

		fmt.Fprintf(w, "%s\t%s\t%d\t%s\t%.2f\t", a.name, a.date.Format("Jan _2"), a.rec, a.symbol, a.price)
		fmt.Fprintf(w, "%.2f\t%.2f\t%.2f\t%s\n", a.currPrice, a.last50Diff, a.last200Diff, a.priceRange)
	}
	w.Flush()
}

func main() {
	// resp, err := http.Get("http://madmoney.thestreet.com/screener/index.cfm?showview=stocks&showrows=500")
	resp, err := http.PostForm("http://madmoney.thestreet.com/screener/index.cfm?showview=stocks&showrows=500",
		url.Values{"x": {"26"}, "y": {"12"}, "airdate": {"30"}})
	if err != nil {
		log.Fatal(err)
	}

	doc, err := html.Parse(resp.Body)
	resp.Body.Close()
	if err != nil {
		log.Fatal(err)
	}
	var f func(*html.Node)
	f = func(n *html.Node) {
		var done = false
		if n.Type == html.ElementNode && n.Data == "table" {
			for _, a := range n.Attr {
				if a.Key == "id" && a.Val == "stockTable" {
					// fmt.Println(a.Val)
					parse_table(n)
					done = true
					break
				}
			}
		}
		if !done {
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				f(c)
			}
		}
	}
	f(doc)
}

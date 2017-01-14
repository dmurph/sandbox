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
)

type mrow struct {
	name   string
	symbol string
	date   string
	rec    int
	price  float64
}
type mrows []mrow

func (slice mrows) Len() int {
	return len(slice)
}

func (slice mrows) Less(i, j int) bool {
	return slice[i].symbol < slice[j].symbol
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
			s.date = c.FirstChild.Data
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
	s := make(mrows, 0)
	// buf := new(bytes.Buffer)
	// html.Render(buf, n);
	// fmt.Printf("Got HTML!\n%s", buf)

	tickerToData := make(map[string]string)

	for c := n.FirstChild.NextSibling.FirstChild.NextSibling.NextSibling; c != nil; c = c.NextSibling {
		// fmt.Printf("Got node type %s\n", c.Type)
		if c.Type != html.ElementNode {
			// fmt.Printf("Not using table element %s\n", c.Data);
			continue
		}
		if c.Data == "tr" {
			var row = parse_row(c)
			s = append(s, row)
			tickerToData[row.symbol] = ""
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
	var prices = strings.Split(body, "\n");
	pricesMap := make(map[string]string)
	for _, i := range prices {
		if i == "" {
			continue
		}
		i = strings.Replace(i, "\"", "", -1);
		var sections = strings.SplitN(i, ",", 2);
		if len(sections) == 0 {
			continue;
		}
		pricesMap[sections[0]] = strings.Replace(sections[1], ",", "\t", -1);
	}

	resp.Body.Close()

	sort.Sort(s)

	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 5, 8, 1, '\t', 0)
	fmt.Fprintln(w, "Name\tDate\tCall\tSymbol\tPrice\tPrevious Close\t50 Day %\t200 Day %\t52 Weeks")
	for _, a := range s {
		fmt.Fprintf(w, "%s\t%s\t%d\t%s\t%.2f\t", a.name, a.date, a.rec, a.symbol, a.price)
		fmt.Fprintf(w, "%s\n", pricesMap[a.symbol])
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

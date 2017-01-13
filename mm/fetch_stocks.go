package main

import (
     // "bytes"
     "os"
	"fmt"
	"golang.org/x/net/html"
	"log"
	"net/http"
	"sort"
	"strconv"
	"net/url"
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
			s.price = price2;
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

	for c := n.FirstChild.NextSibling.FirstChild.NextSibling.NextSibling; c != nil; c = c.NextSibling {
		// fmt.Printf("Got node type %s\n", c.Type)
		if c.Type != html.ElementNode {
			// fmt.Printf("Not using table element %s\n", c.Data);
			continue
		}
		if c.Data == "tr" {
			s = append(s, parse_row(c))
		}
	}
	sort.Sort(s)
	w := new(tabwriter.Writer)
	w.Init(os.Stdout, 0, 8, 0, '\t', 0)
	fmt.Fprintln(w, "Name\tDate\tCall\tSymbol\tPrice")
	for _, a := range s {
	  fmt.Fprintf(w, "%s\t%s\t%d\t%s\t%.2f\n", a.name, a.date, a.rec, a.symbol, a.price);
	}
	w.Flush()
}

func main() {
	// resp, err := http.Get("http://madmoney.thestreet.com/screener/index.cfm?showview=stocks&showrows=500")
	resp, err := http.PostForm("http://madmoney.thestreet.com/screener/index.cfm?showview=stocks&showrows=500",
		url.Values{"x": {"26"}, "y": {"12"},"airdate": {"30"},})
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

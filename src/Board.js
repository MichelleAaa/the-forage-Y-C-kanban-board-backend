import React from 'react';
import Dragula from 'dragula';
import 'dragula/dist/dragula.css';
import Swimlane from './Swimlane';
import './Board.css';
import axios from 'axios'; 

export default class Board extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      clients: {
        // Placeholder Data, while waiting for API:
        backlog: [{"id":20,"name":"Murphy, Lang and Ferry","description":"Organized Explicit Access","status":"backlog","priority":11}],
        inProgress: [{"id":20,"name":"Murphy, Lang and Ferry","description":"Organized Explicit Access","status":"in-progress","priority":11}],
        complete: [{"id":20,"name":"Murphy, Lang and Ferry","description":"Organized Explicit Access","status":"complete","priority":11}]
      }
    }
    this.swimlanes = {
      backlog: React.createRef(),
      inProgress: React.createRef(),
      complete: React.createRef(),
    }
    this.drake = null;
  }

  getClients() {
    axios.get('http://localhost:3001/api/v1/clients')
    .then(response => {
      this.setState({
        clients: {
          backlog: response.data.filter(client => !client.status || client.status === 'backlog'),
          inProgress: response.data.filter(client => client.status && client.status === 'in-progress'),
          complete: response.data.filter(client => client.status && client.status === 'complete'),
        }
      });
      return response.data;
    })
    .catch(function (error){
      console.log(error);
    })
  }
  renderSwimlane(name, clients, ref) {
    return (
      <Swimlane name={name} clients={clients} dragulaRef={ref}/>
    );
  }

  updateClient(el, target, source, sibling){
    // Reverting DOM changes from Dragula
    this.drake.cancel(true);

    let elCategory = el.getAttribute(['data-status']);
    let elId = el.getAttribute(['data-id']);
    let targetId = target.getAttribute(['data-id']);

    //Get current category of the el
    let oldCategory = ""; 
    if (elCategory === "backlog"){
      oldCategory = 'backlog';
    } else if (elCategory === "in-progress"){
      oldCategory = "inProgress";
    } else if (elCategory === "complete"){
      oldCategory = 'complete';
    }

    //Get the element
    let element = this.state.clients[oldCategory].filter(client => elId == client.id);

    // Copy all other elements from the origin list and sort them by their priority:
    let newList = this.state.clients[oldCategory].filter(client => {
      return elId != client.id}).sort(function(a, b){return a.priority - b.priority});

  // Update all the indexes of the new list:
    let oldListReprioritized = [];

    for (let j = 1; j <= newList.length; j++){
      newList[j - 1].priority = j;
      oldListReprioritized.push(newList[j - 1]);
    }

    this.setState(prevState => {
      let newClients = Object.assign({}, prevState.clients);
      newClients[oldCategory] = oldListReprioritized;
      return { clients: newClients };
    })

    // Find the new category & update the element's status property to the new category name:
    let newCategory = ""; 
    if (targetId === "Backlog"){
      newCategory = 'backlog';
      element[0].status = 'backlog';
    } else if (targetId === "In Progress"){
      newCategory = "inProgress";
      element[0].status = 'in-progress';
    } else if (targetId === "Complete"){
      newCategory = 'complete';
      element[0].status = 'complete';
    }
          
    // Copy the new category's list:
    let newCategoryCopy = this.state.clients[newCategory];

    // Copy all other elements from the origin list and sort them by their priority:
    let newDestinationList = this.state.clients[newCategory];

    if(sibling){
      let siblingId = sibling.getAttribute(['data-id'])
      let siblingData = this.state.clients[newCategory].filter(client => siblingId == client.id);

      element[0].priority = siblingData[0].priority - 0.5;
    } else if (!sibling && newDestinationList.length === 0) {
      element[0].priority = 1;
    } else {
      element[0].priority = newDestinationList.length;
    }

    // Push in the new element to the new list:
    newDestinationList.push(element[0]);

    // Re-sort the list:
    newDestinationList.sort(function(a, b){return a.priority - b.priority});

  // Update all the indexes of the new list:
    let newListReprioritized = [];

    for (let j = 1; j <= newDestinationList.length; j++){
      newDestinationList[j - 1].priority = j;
      newListReprioritized.push(newDestinationList[j - 1]);
    }

    this.setState(prevState => {
      let newClients = Object.assign({}, prevState.clients);
      newClients[newCategory] = newCategoryCopy;
      return { clients: newClients };
    });

    // The state in the db is all in one table. (When it's pulled through a GET request it's broken up into categories at that point.) This is to transfer the data back into one set.
    let newState = JSON.parse(JSON.stringify([...this.state.clients.backlog, ...this.state.clients.inProgress, ...this.state.clients.complete]));

    //Send a PUT request to the backend endpoint.
    axios.put('http://localhost:3001/api/v1/clients', newState)
      .then(res => {
        console.log('Sent updated list.');
      })
      .catch(function (error){
        console.log(error);
      });    
  } 

  componentWillMount() {
    axios.get('http://localhost:3001/api/v1/clients')
      .then(response => {
      this.setState({
        clients: {
          backlog: response.data.filter(client => !client.status || client.status === 'backlog').sort(function(a, b){return a.priority - b.priority}),
          inProgress: response.data.filter(client => client.status && client.status === 'in-progress').sort(function(a, b){return a.priority - b.priority}),
          complete: response.data.filter(client => client.status && client.status === 'complete').sort(function(a, b){return a.priority - b.priority}),
        }
      });
      })
      .catch(function (error){
        console.log(error);
      })
  }

  componentDidMount() {
    this.drake = Dragula([this.swimlanes.backlog, this.swimlanes.inProgress, this.swimlanes.complete], {
      isContainer: function (el) {
        return el.classList.contains('Swimlane-dragColumn');
      },
      moves: function (el, source, handle, sibling) {
        return true;
      },
      accepts: function (el, target, source, sibling) {
        return true;
      },
      copy: false,           
      copySortSource: false,
      revertOnSpill: false,              
      removeOnSpill: false,   
      mirrorContainer: document.body,   
      ignoreInputTextSelection: true
    });

    this.drake.on('drop', (el, target, source, sibling) => {
      this.updateClient(el, target, source, sibling);
    });
  }

  componentWillUnmount() {
    this.drake.remove();
  }

  render() {
    return ( 
      <div className="Board">
        <div className="container-fluid">
          <div className="row"> 
            <div className="col-md-4">
              {this.renderSwimlane('Backlog', this.state.clients.backlog, this.swimlanes.backlog)}
              </div>
            <div className="col-md-4">
              {this.renderSwimlane('In Progress', this.state.clients.inProgress, this.swimlanes.inProgress)}
              </div>
            <div className="col-md-4">
              {this.renderSwimlane('Complete', this.state.clients.complete, this.swimlanes.complete)}
              </div>  
          </div>
        </div>
      </div>
    );
  }
}